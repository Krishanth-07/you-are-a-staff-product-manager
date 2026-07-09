import { useState } from "react";
import { motion } from "framer-motion";
import { askAI } from "../api";

function summarizeSimulation(simulation) {
  if (!simulation) return null;
  const finalStep =
    simulation.time_steps_data?.[simulation.time_steps_data.length - 1] || [];
  const counts = finalStep.reduce(
    (acc, cell) => {
      acc[cell.status] = (acc[cell.status] || 0) + 1;
      return acc;
    },
    { unburnt: 0, burning: 0, burnt: 0 },
  );

  return {
    grid_size: simulation.grid_size,
    final_risk_score: simulation.final_risk_score,
    risk_factors: simulation.risk_factors,
    total_cells_burnt: simulation.total_cells_burnt,
    final_step_counts: counts,
  };
}

function TypingDots() {
  return (
    <div className="mr-8 flex gap-1 rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3">
      {[0, 1, 2].map((dot) => (
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          className="h-2 w-2 rounded-full bg-cyan-300"
          key={dot}
          transition={{ duration: 0.8, delay: dot * 0.14, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export default function AskAIPanel({ simulation, recommendation, addLog }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const submitQuestion = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuestion("");
    setLoading(true);
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    try {
      const context = {
        simulation: summarizeSimulation(simulation),
        incident_commander: recommendation,
      };
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const response = await askAI(trimmed, context);
      setMessages((current) => [
        ...current,
        { role: "ai", text: response.answer },
      ]);
      addLog?.("Ask AI answered");
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: "ai", text: err.message || "AI request failed" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Ask FireShield AI
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Ask about spread, road access, evacuation timing, or resource needs.
        </p>
      </div>
      <div className="command-scroll mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-3 text-sm leading-6 ${message.role === "user" ? "ml-8 border-cyan-400/15 bg-cyan-400/10 text-cyan-50" : "mr-8 border-slate-200/10 bg-slate-950/55 text-slate-100"}`}
            initial={{ opacity: 0, y: 8 }}
            key={`${message.role}-${index}`}
          >
            {message.text}
          </motion.div>
        ))}
        {loading && <TypingDots />}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-2xl border border-slate-200/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask FireShield AI..."
          value={question}
        />
        <button
          className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          type="submit"
        >
          Send
        </button>
      </form>
    </section>
  );
}

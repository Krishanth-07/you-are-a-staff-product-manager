import { useState } from "react";
import { motion } from "framer-motion";
import { askAI } from "../api";

function summarizeSimulation(simulation) {
  if (!simulation) return null;
  return {
    final_risk_score: simulation.final_risk_score,
    risk_factors: simulation.risk_factors,
    total_area_burnt: simulation.total_cells_burnt,
  };
}

function TypingDots() {
  return (
    <div className="mr-8 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-3 w-16 items-center justify-center">
      {[0, 1, 2].map((dot) => (
        <motion.span
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
          className="h-1.5 w-1.5 rounded-full bg-blue-600"
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
        { role: "ai", text: err.response?.data?.detail || err.message || "AI request failed" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-6">
      <div className="border-b border-gray-100 pb-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
          Ask FireShield AI
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Ask questions regarding simulation details, resource planning, or weather impacts.
        </p>
      </div>

      <div className="command-scroll mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border p-3 text-xs leading-relaxed ${
              message.role === "user"
                ? "ml-8 border-blue-100 bg-blue-50 text-blue-900"
                : "mr-8 border-gray-200 bg-gray-50 text-gray-800"
            }`}
            initial={{ opacity: 0, y: 6 }}
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
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-600 transition-colors"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask FireShield AI..."
          value={question}
        />
        <button
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors duration-150"
          type="submit"
        >
          Send
        </button>
      </form>
    </section>
  );
}

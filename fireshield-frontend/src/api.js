import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8001',
  timeout: 60000,
})

export const getRegionData = async () => {
  const { data } = await api.get('/region-data')
  return data
}

export const getHistoricalPresets = async () => {
  const { data } = await api.get('/historical-presets')
  return data
}

export const getLiveWeather = async () => {
  const { data } = await api.get('/api/weather')
  return data
}

export const simulate = async (params) => {
  const { data } = await api.post('/simulate', params)
  return data
}

export const simulateEnsemble = async (params) => {
  const { data } = await api.post('/simulate-ensemble', params)
  return data
}

export const getActiveFires = async () => {
  const { data } = await api.get('/api/active-fires')
  return data
}

export const getIncidentCommander = async (params) => {
  const { data } = await api.post('/incident-commander', params)
  return data
}

export const getPublicAlerts = async (params) => {
  const { data } = await api.post('/public-alert', params)
  return data
}

export const askAI = async (question, context) => {
  const { data } = await api.post('/ask-ai', { question, context })
  return data
}

export const generateIncidentReport = async (simulationData, incidentCommanderData, logs) => {
  const { data } = await api.post('/incident-report', {
    simulation_data: simulationData,
    incident_commander_data: incidentCommanderData,
    logs,
  })
  return data
}

import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 60000,
})

export const getRegionData = async () => {
  const { data } = await api.get('/region-data')
  return data
}

export const simulate = async (params) => {
  const { data } = await api.post('/simulate', params)
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

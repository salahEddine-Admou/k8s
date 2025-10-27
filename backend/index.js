const express = require('express')
const cors = require('cors')
const client = require('prom-client')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3003
const conn = require('./conn')

// Prometheus metrics
const register = new client.Registry()
client.collectDefaultMetrics({ register })

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
})

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
})

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
})

register.registerMetric(httpRequestDuration)
register.registerMetric(httpRequestTotal)
register.registerMetric(activeConnections)

// Middleware for metrics
app.use((req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode
    }
    
    httpRequestDuration.observe(labels, duration)
    httpRequestTotal.inc(labels)
  })
  
  next()
})

app.use(express.json())
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:30001', 'http://localhost:3000'],
  credentials: true
}))

const tripRoutes = require('./routes/trip.routes')

app.use('/trip', tripRoutes) // http://localhost:3003/trip --> POST/GET/GET by ID

app.get('/hello', (req,res)=>{
    res.send('Hello World!')
})

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, ()=>{
    console.log(`Server started at http://localhost:${PORT}`)
    console.log(`Metrics available at http://localhost:${PORT}/metrics`)
})
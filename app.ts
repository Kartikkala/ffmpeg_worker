import express from 'express'
import cors from 'cors'

const app = express()

app.disable('x-powered-by')
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(cors())



const port = 8945
const server = app.listen(port, '127.0.0.1', () => { console.log("Listening on port "+port+"...") })
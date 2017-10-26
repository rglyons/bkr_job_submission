const express = require('express')
const bodyParser = require('body-parser')
const app = express()

// Parse incoming requests data (https://github.com/expressjs/body-parser)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use('/static', express.static(__dirname + '/static'))
app.use('/node_modules', express.static(__dirname + '/node_modules'))

app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/webpage/src/index.html')
  res.sendFile(__dirname + '/index.html')
})

// Require our other routes into the application.
require('./server/routes')(app)

app.listen(3030, function () {
  console.log('Beaker Job Submission application listening on port 3030')
})

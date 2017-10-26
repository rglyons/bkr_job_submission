const queryController = require('../controllers').query
const jobController = require('../controllers').job

module.exports = (app) => {
  app.get('/api', (req, res) => res.status(200).send({
    message: 'Welcome to the Beaker Job Submission API!'
  }));

  // query
  app.get('/api/query/lab_data', queryController.getLabData);
  app.post('/api/job/execute_job', jobController.executeJob);

}

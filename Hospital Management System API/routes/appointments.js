const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');

router.post('/', async (req, res) => {
  try {
    const appointment = new Appointment(req.body);
    await appointment.save();
    res.status(200).json({ message: 'Appointment scheduled successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;

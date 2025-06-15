const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  appointmentDate: Date,
  status: String, // "Scheduled", "Completed", "Cancelled"
});

module.exports = mongoose.model('Appointment', appointmentSchema);

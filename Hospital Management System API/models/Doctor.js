const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: String,
  specialty: String,
  experience: Number,
  availability: [String],
});

module.exports = mongoose.model('Doctor', doctorSchema);

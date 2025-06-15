const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

// 1. Doctors with total appointments
router.get('/doctors-with-appointments', async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      { $group: { _id: '$doctorId', totalAppointments: { $sum: 1 } } },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
        },
      },
      { $unwind: '$doctor' },
      {
        $project: {
          doctorName: '$doctor.name',
          specialty: '$doctor.specialty',
          totalAppointments: 1,
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 2. Patient medical history + appointments
router.get('/patient-medical-history/:id', async (req, res) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.params.id);
    const result = await Patient.aggregate([
      { $match: { _id: patientId } },
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'patientId',
          as: 'appointments',
        },
      },
      {
        $unwind: { path: '$appointments', preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: 'doctors',
          localField: 'appointments.doctorId',
          foreignField: '_id',
          as: 'doctorInfo',
        },
      },
      {
        $unwind: { path: '$doctorInfo', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          name: 1,
          medicalHistory: 1,
          appointmentDate: '$appointments.appointmentDate',
          status: '$appointments.status',
          doctorName: '$doctorInfo.name',
          specialty: '$doctorInfo.specialty',
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 3. Top 3 most booked specialties
router.get('/top-specialties', async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      {
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor',
        },
      },
      { $unwind: '$doctor' },
      {
        $group: {
          _id: '$doctor.specialty',
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 3 },
      {
        $project: {
          specialty: '$_id',
          totalAppointments: '$total',
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 4. Percentage of cancelled appointments per doctor
router.get('/cancelled-appointments', async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      {
        $group: {
          _id: '$doctorId',
          total: { $sum: 1 },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          cancellationRate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor',
        },
      },
      { $unwind: '$doctor' },
      {
        $project: {
          doctorName: '$doctor.name',
          specialty: '$doctor.specialty',
          cancellationRate: 1,
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 5. Appointments per month
router.get('/monthly-appointments', async (req, res) => {
  try {
    const result = await Appointment.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$appointmentDate' },
            month: { $month: '$appointmentDate' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.month' },
              '/',
              { $toString: '$_id.year' },
            ],
          },
          count: 1,
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 6. Active patients (visited >3 times in last 6 months)
router.get('/active-patients', async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: sixMonthsAgo },
          status: { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: '$patientId',
          visits: { $sum: 1 },
        },
      },
      { $match: { visits: { $gt: 3 } } },
      {
        $lookup: {
          from: 'patients',
          localField: '_id',
          foreignField: '_id',
          as: 'patient',
        },
      },
      { $unwind: '$patient' },
      {
        $project: {
          name: '$patient.name',
          age: '$patient.age',
          visits: 1,
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 7. Doctor availability on a given day
router.get('/doctor-availability/:day', async (req, res) => {
  try {
    const day = req.params.day;
    const result = await Doctor.aggregate([
      { $unwind: '$availability' },
      { $match: { availability: day } },
      {
        $project: {
          name: 1,
          specialty: 1,
          availability: 1,
        },
      },
    ]);

    if (result.length === 0) return res.status(200).json({ message: 'No data found' });
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;

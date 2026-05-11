const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();


// ------------------
// Middleware
// ------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));


// ------------------
// EJS
// ------------------
app.set("view engine", "ejs");


// ------------------
// MongoDB Connection
// Replace with YOUR real Atlas connection string
// ------------------
mongoose.connect("YOUR_MONGODB_CONNECTION_STRING")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


// ------------------
// Tutor Schema
// ------------------
const tutorSchema = new mongoose.Schema({
  name: String,
  email: String,
  subject: String,
  grade: String,
  availability: String,
  bio: String
});

const Tutor = mongoose.model("Tutor", tutorSchema);


// ------------------
// Routes
// ------------------

// Home
app.get("/", (req, res) => {
  res.render("home");
});


// Show all tutors
app.get("/tutors", async (req, res) => {
  try {
    const tutors = await Tutor.find();
    res.render("tutors", { tutors });
  } catch (error) {
    console.log(error);
    res.send("Error loading tutors");
  }
});


// Tutor signup form
app.get("/tutors/new", (req, res) => {
  res.render("newTutor");
});


// Save tutor
app.post("/tutors", async (req, res) => {
  try {
    const {
      name,
      email,
      subject,
      grade,
      availability,
      bio
    } = req.body;

    const newTutor = new Tutor({
      name,
      email,
      subject,
      grade,
      availability,
      bio
    });

    await newTutor.save();

    res.redirect("/tutors");

  } catch (error) {
    console.log(error);
    res.send("Error saving tutor");
  }
});


// Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
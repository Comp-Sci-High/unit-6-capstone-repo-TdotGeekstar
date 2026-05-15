const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();


// -------------------
// MIDDLEWARE
// -------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "compscihigh-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.set("view engine", "ejs");


// -------------------
// DATABASE
// -------------------
mongoose.connect("YOUR_MONGODB_CONNECTION_STRING")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


// -------------------
// USER SCHEMA
// -------------------
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,

  role: String, // teacher or student

  verified: {
    type: Boolean,
    default: false
  }
});

const User = mongoose.model("User", userSchema);


// -------------------
// TUTOR SESSION SCHEMA
// -------------------
const tutorSchema = new mongoose.Schema({
  name: String,
  owner: String,

  department: String,
  subject: String,
  bio: String,

  sessionDate: String,
  sessionTime: String,

  priority: {
    type: Boolean,
    default: false
  },

  maxStudents: Number,

  currentStudents: {
    type: Number,
    default: 0
  },

  bookedBy: [String]
});

const Tutor = mongoose.model("Tutor", tutorSchema);


// -------------------
// AUTH HELPERS
// -------------------
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
}

// Only teachers can access admin page
function requireTeacher(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (req.session.user.role !== "teacher") {
    return res.send("Access denied.");
  }

  next();
}


// -------------------
// DETECT ROLE
// -------------------
function detectRole(email) {
  const teacherPattern =
    /^[a-z]+\.[a-z]+@compscihigh\.org$/i;

  const studentPattern =
    /^[a-z]+\.[a-z]+\d{2}@compscihigh\.org$/i;

  if (teacherPattern.test(email)) {
    return "teacher";
  }

  if (studentPattern.test(email)) {
    return "student";
  }

  return null;
}


// -------------------
// HOME
// -------------------
app.get("/", (req, res) => {
  res.render("home", {
    user: req.session.user
  });
});


// -------------------
// REGISTER
// -------------------
app.get("/register", (req, res) => {
  res.render("register", {
    user: req.session.user
  });
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const role = detectRole(email);

  if (!role) {
    return res.send(
      "Must use a valid Comp Sci High email."
    );
  }

  const hashed =
    await bcrypt.hash(password, 10);

  await User.create({
    username,
    email,
    password: hashed,
    role,
    verified: role === "teacher"
  });

  res.redirect("/login");
});


// -------------------
// LOGIN
// -------------------
app.get("/login", (req, res) => {
  res.render("login", {
    user: req.session.user
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user =
    await User.findOne({ username });

  if (!user) {
    return res.send("User not found.");
  }

  const valid =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!valid) {
    return res.send("Wrong password.");
  }

  req.session.user = user;

  res.redirect("/");
});


// -------------------
// LOGOUT
// -------------------
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});


// -------------------
// ADMIN VERIFY PAGE
// -------------------
app.get(
  "/admin/verify",
  requireTeacher,
  async (req, res) => {
    const pendingStudents =
      await User.find({
        role: "student",
        verified: false
      });

    res.render("adminVerify", {
      user: req.session.user,
      pendingStudents
    });
  }
);


// Approve student
app.post(
  "/admin/verify/:id",
  requireTeacher,
  async (req, res) => {
    await User.findByIdAndUpdate(
      req.params.id,
      { verified: true }
    );

    res.redirect("/admin/verify");
  }
);


// -------------------
// TUTORS
// -------------------
app.get("/tutors", async (req, res) => {
  const tutors = await Tutor.find();

  res.render("tutors", {
    tutors,
    user: req.session.user
  });
});


// -------------------
// CREATE SESSION
// -------------------
app.get(
  "/tutors/new",
  requireLogin,
  (req, res) => {
    res.render("newTutor", {
      user: req.session.user
    });
  }
);

app.post(
  "/tutors",
  requireLogin,
  async (req, res) => {
    const user = req.session.user;

    if (
      user.role === "student" &&
      !user.verified
    ) {
      return res.send(
        "Student tutor account awaiting approval from Director of Academic Support."
      );
    }

    await Tutor.create({
      ...req.body,
      owner: user.username,
      priority:
        user.role === "teacher",
      bookedBy: []
    });

    res.redirect("/tutors");
  }
);


// -------------------
// BOOK SESSION
// -------------------
app.post(
  "/tutors/:id/book",
  requireLogin,
  async (req, res) => {
    const tutor =
      await Tutor.findById(
        req.params.id
      );

    const username =
      req.session.user.username;

    if (
      tutor.bookedBy.includes(
        username
      )
    ) {
      return res.send(
        "You already booked this session."
      );
    }

    if (
      tutor.currentStudents >=
      tutor.maxStudents
    ) {
      return res.send(
        "Session full."
      );
    }

    tutor.bookedBy.push(
      username
    );

    tutor.currentStudents += 1;

    await tutor.save();

    res.redirect("/tutors");
  }
);


// -------------------
// DELETE SESSION
// -------------------
app.post(
  "/tutors/:id/delete",
  requireLogin,
  async (req, res) => {
    const tutor =
      await Tutor.findById(
        req.params.id
      );

    if (
      tutor.owner !==
      req.session.user.username
    ) {
      return res.send(
        "Unauthorized."
      );
    }

    await Tutor.findByIdAndDelete(
      req.params.id
    );

    res.redirect("/tutors");
  }
);


// -------------------
app.listen(3000, () => {
  console.log(
    "Server running on http://localhost:3000"
  );
});
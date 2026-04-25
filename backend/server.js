const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "shasa_tech",
  password: process.env.DB_PASSWORD || "mjnns",
  port: process.env.DB_PORT || 5432,
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ================= SCHOOL =================
app.get("/school/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM schools WHERE id=$1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json("School not found");
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json("Invalid");
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Login error");
  }
});

// ================= ADMIN =================
app.post("/admin/create-school", async (req, res) => {
  try {
    const { name } = req.body;

    const result = await pool.query(
      "INSERT INTO schools (name) VALUES ($1) RETURNING *",
      [name]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/admin/schools", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM schools ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/admin/create-user", async (req, res) => {
  try {
    const { name, email, password, role, school_id, phone } = req.body;

    const result = await pool.query(
      "INSERT INTO users (name,email,password,role,school_id,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, email, password, role, school_id, phone]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= STUDENTS =================
app.post("/students", async (req, res) => {
  try {
    const { name, email, class: studentClass, phone, school_id } = req.body;

    const result = await pool.query(
      "INSERT INTO students (name,email,class,phone,school_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, email, studentClass, phone, school_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/students/:school_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM students WHERE school_id=$1",
      [req.params.school_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.delete("/students/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM students WHERE id=$1", [req.params.id]);
    res.json("Deleted");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.put("/students/:id", async (req, res) => {
  try {
    const { name, email, class: studentClass, phone } = req.body;

    await pool.query(
      "UPDATE students SET name=$1,email=$2,class=$3,phone=$4 WHERE id=$5",
      [name, email, studentClass, phone, req.params.id]
    );

    res.json("Updated");
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= ATTENDANCE =================
app.get("/attendance-check/:school_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM attendance WHERE school_id=$1 AND date=CURRENT_DATE",
      [req.params.school_id]
    );

    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/attendance", async (req, res) => {
  try {
    const { records, school_id } = req.body;

    const check = await pool.query(
      "SELECT * FROM attendance WHERE school_id=$1 AND date=CURRENT_DATE",
      [school_id]
    );

    if (check.rows.length > 0) {
      return res.status(400).json("Already taken");
    }

    for (let r of records) {
      await pool.query(
        "INSERT INTO attendance (student_id,date,status,school_id) VALUES ($1,CURRENT_DATE,$2,$3)",
        [r.student_id, r.status, school_id]
      );
    }

    res.json("Saved");
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/attendance/:school_id/:date", async (req, res) => {
  try {
    const { school_id, date } = req.params;

    const result = await pool.query(
      `SELECT s.name, a.status
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.school_id=$1 AND a.date=$2`,
      [school_id, date]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= FEES =================
app.post("/fees", async (req, res) => {
  try {
    const { student_id, amount, type, month, school_id } = req.body;

    const result = await pool.query(
      "INSERT INTO fees (student_id,amount,type,month,school_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [student_id, amount, type, month || null, school_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.post("/payments", async (req, res) => {
  try {
    const { student_id, amount, school_id } = req.body;

    const result = await pool.query(
      "INSERT INTO payments (student_id,amount,school_id) VALUES ($1,$2,$3) RETURNING *",
      [student_id, amount, school_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.get("/fees/:school_id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        f.id,
        s.name,
        f.student_id,
        f.amount AS total,
        COALESCE(SUM(p.amount),0) AS paid,
        (f.amount - COALESCE(SUM(p.amount),0)) AS pending
      FROM fees f
      JOIN students s ON s.id = f.student_id
      LEFT JOIN payments p ON p.student_id = f.student_id
      WHERE f.school_id = $1
      GROUP BY f.id, s.name
      ORDER BY f.id DESC`,
      [req.params.school_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= DASHBOARD =================
app.get("/dashboard/:school_id", async (req, res) => {
  try {
    const id = req.params.school_id;

    const totalFees = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM fees WHERE school_id=$1",
      [id]
    );

    const totalPaid = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE school_id=$1",
      [id]
    );

    const today = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE school_id=$1 AND DATE(date_paid)=CURRENT_DATE",
      [id]
    );

    const attendance = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status='present') AS present,
        COUNT(*) FILTER (WHERE status='absent') AS absent
       FROM attendance
       WHERE school_id=$1 AND date=CURRENT_DATE`,
      [id]
    );

    res.json({
      total_collected: totalPaid.rows[0].total,
      today_collection: today.rows[0].total,
      total_fees: totalFees.rows[0].total,
      total_paid: totalPaid.rows[0].total,
      pending: totalFees.rows[0].total - totalPaid.rows[0].total,
      present: attendance.rows[0].present || 0,
      absent: attendance.rows[0].absent || 0,
    });
  } catch (err) {
    res.status(500).send("Error");
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
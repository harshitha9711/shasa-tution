const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "shasa_tech",
  password: "mjnns",
  port: 5432,
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1 AND password=$2",
    [email, password]
  );

  if (result.rows.length === 0) {
    return res.status(401).json("Invalid");
  }

  res.json(result.rows[0]);
});

// ================= ADMIN =================
app.post("/admin/create-school", async (req, res) => {
  const { name } = req.body;

  const result = await pool.query(
    "INSERT INTO schools (name) VALUES ($1) RETURNING *",
    [name]
  );

  res.json(result.rows[0]);
});

app.get("/admin/schools", async (req, res) => {
  const result = await pool.query("SELECT * FROM schools ORDER BY id DESC");
  res.json(result.rows);
});

app.post("/admin/create-user", async (req, res) => {
  const { name, email, password, role, school_id, phone } = req.body;

  const result = await pool.query(
    "INSERT INTO users (name,email,password,role,school_id,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [name, email, password, role, school_id, phone]
  );

  res.json(result.rows[0]);
});

// ================= STUDENTS =================
app.post("/students", async (req, res) => {
  const { name, email, class: studentClass, phone, school_id } = req.body;

  const result = await pool.query(
    "INSERT INTO students (name,email,class,phone,school_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [name, email, studentClass, phone, school_id]
  );

  res.json(result.rows[0]);
});

app.get("/students/:school_id", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM students WHERE school_id=$1",
    [req.params.school_id]
  );

  res.json(result.rows);
});

// ================= ATTENDANCE =================
app.post("/attendance", async (req, res) => {
  const { records, school_id } = req.body;

  // block duplicate entry
  const check = await pool.query(
    "SELECT * FROM attendance WHERE school_id=$1 AND date=CURRENT_DATE",
    [school_id]
  );

  if (check.rows.length > 0) {
    return res.status(400).json("Attendance already taken ❌");
  }

  for (let r of records) {
    await pool.query(
      "INSERT INTO attendance (student_id,date,status,school_id) VALUES ($1,CURRENT_DATE,$2,$3)",
      [r.student_id, r.status, school_id]
    );
  }

  res.json("Saved");
});

// ✅ NEW: GET ATTENDANCE BY DATE
app.get("/attendance/:school_id/:date", async (req, res) => {
  const { school_id, date } = req.params;

  const result = await pool.query(`
    SELECT s.name, a.status
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    WHERE a.school_id=$1 AND a.date=$2
  `, [school_id, date]);

  res.json(result.rows);
});

// ================= FEES + PAYMENTS =================
app.post("/fees", async (req, res) => {
  const { student_id, amount, type, month, school_id } = req.body;

  const result = await pool.query(
    "INSERT INTO fees (student_id,amount,type,month,school_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [student_id, amount, type, month || null, school_id]
  );

  res.json(result.rows[0]);
});

app.post("/payments", async (req, res) => {
  const { student_id, amount, school_id } = req.body;

  const result = await pool.query(
    "INSERT INTO payments (student_id,amount,school_id) VALUES ($1,$2,$3) RETURNING *",
    [student_id, amount, school_id]
  );

  res.json(result.rows[0]);
});

app.get("/fees/:school_id", async (req, res) => {
  const result = await pool.query(`
    SELECT 
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
    ORDER BY f.id DESC
  `, [req.params.school_id]);

  res.json(result.rows);
});

async function viewAttendance(){
  const date = document.getElementById("attDate").value;

  if (!date) {
    alert("Select date ❌");
    return;
  }

  const res = await fetch(`http://localhost:5000/attendance/${user.school_id}/${date}`);
  const data = await res.json();

  const list = document.getElementById("attList");
  list.innerHTML = "";

  let present = [];
  let absent = [];

  data.forEach(s => {
    if (s.status === "present") present.push(s.name);
    else absent.push(s.name);
  });

  list.innerHTML = `
    <li><b>Present:</b> ${present.join(", ")}</li>
    <li><b>Absent:</b> ${absent.join(", ")}</li>
  `;
}

// ================= DASHBOARD =================
app.get("/dashboard/:school_id", async (req, res) => {
  try {
    const id = req.params.school_id;

    // TOTAL FEES
    const totalFees = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM fees WHERE school_id=$1",
      [id]
    );

    // TOTAL PAID
    const totalPaid = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE school_id=$1",
      [id]
    );

    // TODAY COLLECTION
    const today = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE school_id=$1 AND DATE(date_paid)=CURRENT_DATE",
      [id]
    );

    // ATTENDANCE
    const attendance = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status='present') AS present,
        COUNT(*) FILTER (WHERE status='absent') AS absent
      FROM attendance
      WHERE school_id=$1 AND date=CURRENT_DATE
    `, [id]);

    res.json({
      total_collected: totalPaid.rows[0].total,
      today_collection: today.rows[0].total,
      total_fees: totalFees.rows[0].total,
      total_paid: totalPaid.rows[0].total,
      pending: totalFees.rows[0].total - totalPaid.rows[0].total,
      present: attendance.rows[0].present || 0,
      absent: attendance.rows[0].absent || 0
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json("Error");
  }
});
app.listen(5000, () => console.log("Server running 🚀"));
const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ROOT
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// SCHOOL
app.get("/school/:id", async (req, res) => {
  const r = await pool.query("SELECT * FROM schools WHERE id=$1",[req.params.id]);
  res.json(r.rows[0]);
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const r = await pool.query(
    "SELECT * FROM users WHERE email=$1 AND password=$2",
    [email, password]
  );

  if (r.rows.length === 0) return res.status(401).json("Invalid");
  res.json(r.rows[0]);
});

// ADMIN
app.post("/admin/create-school", async (req, res) => {
  const r = await pool.query(
    "INSERT INTO schools(name) VALUES($1) RETURNING *",
    [req.body.name]
  );
  res.json(r.rows[0]);
});

app.post("/admin/create-user", async (req, res) => {
  const { name,email,password,role,school_id } = req.body;

  const r = await pool.query(
    "INSERT INTO users(name,email,password,role,school_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [name,email,password,role,school_id]
  );

  res.json(r.rows[0]);
});

// STUDENTS
app.post("/students", async (req, res) => {
  const { name,email,class:cls,phone,school_id } = req.body;

  const r = await pool.query(
    "INSERT INTO students(name,email,class,phone,school_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [name,email,cls,phone,school_id]
  );

  res.json(r.rows[0]);
});

app.get("/students/:school_id", async (req,res)=>{
  const r = await pool.query(
    "SELECT * FROM students WHERE school_id=$1",
    [req.params.school_id]
  );
  res.json(r.rows);
});

app.delete("/students/:id", async (req,res)=>{
  await pool.query("DELETE FROM students WHERE id=$1",[req.params.id]);
  res.json("deleted");
});

app.put("/students/:id", async (req,res)=>{
  const { name,email,class:cls,phone } = req.body;

  await pool.query(
    "UPDATE students SET name=$1,email=$2,class=$3,phone=$4 WHERE id=$5",
    [name,email,cls,phone,req.params.id]
  );

  res.json("updated");
});

// ATTENDANCE
app.get("/attendance-check/:school_id", async (req,res)=>{
  const r = await pool.query(
    "SELECT * FROM attendance WHERE school_id=$1 AND date=CURRENT_DATE",
    [req.params.school_id]
  );
  res.json({exists:r.rows.length>0});
});

app.post("/attendance", async (req,res)=>{
  const { records, school_id } = req.body;

  for(let r of records){
    await pool.query(
      "INSERT INTO attendance(student_id,date,status,school_id) VALUES($1,CURRENT_DATE,$2,$3)",
      [r.student_id,r.status,school_id]
    );
  }

  res.json("saved");
});

// FEES
app.post("/fees", async (req,res)=>{
  const { student_id,amount,school_id } = req.body;

  const r = await pool.query(
    "INSERT INTO fees(student_id,amount,school_id) VALUES($1,$2,$3) RETURNING *",
    [student_id,amount,school_id]
  );

  res.json(r.rows[0]);
});

app.post("/payments", async (req,res)=>{
  const { student_id,amount,school_id } = req.body;

  await pool.query(
    "INSERT INTO payments(student_id,amount,school_id) VALUES($1,$2,$3)",
    [student_id,amount,school_id]
  );

  res.json("paid");
});

app.get("/fees/:school_id", async (req,res)=>{
  const r = await pool.query(`
    SELECT 
      s.name,
      f.student_id,
      f.amount AS total,
      COALESCE(SUM(p.amount),0) AS paid,
      (f.amount - COALESCE(SUM(p.amount),0)) AS pending
    FROM fees f
    JOIN students s ON s.id=f.student_id
    LEFT JOIN payments p ON p.student_id=f.student_id
    WHERE f.school_id=$1
    GROUP BY s.name,f.student_id,f.amount
  `,[req.params.school_id]);

  res.json(r.rows);
});

// START
app.listen(process.env.PORT || 5000, ()=>{
  console.log("Running 🚀");
});
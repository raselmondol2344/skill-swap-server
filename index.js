const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT;

const client = new MongoClient(process.env.MONGODB_URI);


// MongoDB Connect
async function connectToMongoDB() {
  try {
    await client.connect();

    console.log("✅ MongoDB connected successfully!");

    const db = client.db("skill-swap");
    const taskCollection = db.collection("task");
    const freelancerCollection = db.collection("freelancer")

    console.log("✅ Database selected:", db.databaseName);


    // =========================
    // All API Section
    // =========================


    //all task
app.get("/task", async (req, res) => {
  const result = await taskCollection.find().toArray();

  res.send(result);
});


// High price 8 tasks
app.get("/task/high-price", async (req, res) => {
  const result = await taskCollection
    .aggregate([
      {
        $addFields: {
          budgetNumber: {
            $toDouble: "$budget",
          },
        },
      },
      {
        $sort: {
          budgetNumber: -1,
        },
      },
      {
        $limit: 8,
      },
    ])
    .toArray();

  res.send(result);
});


// Single task
app.get("/task/:id", async (req, res) => {
  const result = await taskCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});


    // All freelancer get API
    app.get("/freelancer", async (req, res) => {
      const result = await freelancerCollection.find().toArray();

      res.send(result);
    });
    

   

    // top freelancer
    app.get("/freelancer/top-freelancers", async (req, res) => {
    const result = await freelancerCollection
    .find()
    .sort({ rating: -1 })
    .limit(4)
    .toArray();

  res.send(result);
});



 

  } catch (error) {
    console.error("❌ MongoDB connection failed!");
    console.error(error);
  }
}


// Home Route
app.get("/", (req, res) => {
  res.send("server is running");
});


// Start Server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


// Connect MongoDB
connectToMongoDB();

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const { createRemoteJWKSet } = require("jose");
const { jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8000;

// MongoDB Connection
const uri = process.env.MONGLO_DB_URL;
if (!uri) {
  console.warn("⚠️ Warning: MONGLO_DB_URL is not defined in environment variables!");
}
const client = new MongoClient(uri || "mongodb://localhost:27017");

const db = client.db("skill-swap");
const taskCollection = db.collection("task");
const freelancerCollection = db.collection("freelancer");
const userCollection = db.collection("user");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
  }
}
connectToMongoDB();

// JWT Setup
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
let JWKS;
try {
  JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
} catch (error) {
  console.error("JWKS init error:", error.message);
}

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      msg: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      msg: "Unauthorized",
    });
  }

  try {
    if (!JWKS) {
      const activeClientUrl = process.env.CLIENT_URL || "http://localhost:3000";
      JWKS = createRemoteJWKSet(new URL(`${activeClientUrl}/api/auth/jwks`));
    }
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({
      msg: "Unauthorized",
    });
  }
};

// =========================
// All API Routes
// =========================

// Home Route
app.get("/", (req, res) => {
  res.send("SkillSwap server is running");
});

// All Tasks with Category Filter and Search
app.get("/task", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const page = Number(req.query.page) || 1;
    const searchText = req.query.search || "";
    const category = req.query.category || "";

    let query = {};

    if (category && category !== "all") {
      query.category = category;
    }

    if (searchText) {
      query.$or = [
        { title: { $regex: searchText, $options: "i" } },
        { details: { $regex: searchText, $options: "i" } },
        { category: { $regex: searchText, $options: "i" } },
      ];
    }

    const total_data = await taskCollection.countDocuments(query);
    const total_page = Math.ceil(total_data / limit);
    const skip = (page - 1) * limit;

    const data = await taskCollection
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.send({ total_page, skip, page, data });
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
});

// High price 8 tasks
app.get("/task/high-price", async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch high price tasks",
      error: error.message,
    });
  }
});

// Single task
app.get("/task/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Task ID format" });
    }
    const result = await taskCollection.findOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch task",
      error: error.message,
    });
  }
});

// All freelancer
app.get("/freelancer", verifyToken, async (req, res) => {
  try {
    const result = await freelancerCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch freelancers",
      error: error.message,
    });
  }
});

// Top freelancer
app.get("/freelancer/top-freelancers", async (req, res) => {
  try {
    const result = await freelancerCollection
      .find()
      .sort({ rating: -1 })
      .limit(4)
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch top freelancers",
      error: error.message,
    });
  }
});

// Task post API
app.post("/task", async (req, res) => {
  try {
    const task = req.body;
    const newTask = {
      ...task,
      status: "open",
    };
    const result = await taskCollection.insertOne(newTask);
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to create task",
      error: error.message,
    });
  }
});

// Client based tasks
app.get("/client-tasks/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await taskCollection
      .find({ client_id: userId })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch client tasks",
      error: error.message,
    });
  }
});

// Edit task API
app.patch("/task/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Task ID format" });
    }
    const { title, category, budget, deadline, details } = req.body;

    const updateData = {
      title,
      category,
      budget,
      deadline,
      details,
    };

    const result = await taskCollection.updateOne(
      {
        _id: new ObjectId(id),
        status: "open",
      },
      {
        $set: updateData,
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to update task",
      error: error.message,
    });
  }
});

// Delete Task API
app.delete("/task/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Task ID format" });
    }
    const result = await taskCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        deletedCount: 0,
        message: "Task not found",
      });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete task",
      error: error.message,
    });
  }
});

// Apply for task
app.patch("/task/:id/apply", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Task ID format" });
    }
    const { userId } = req.body;

    const result = await taskCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          applied_freelancers: userId,
        },
        $set: {
          status: "in-process",
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to apply for task",
      error: error.message,
    });
  }
});

// My proposal task
app.get("/my-proposals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await taskCollection
      .find({
        status: "in-process",
        applied_freelancers: userId,
      })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch proposals",
      error: error.message,
    });
  }
});

// Manage proposals
app.get("/manage-proposals/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await taskCollection
      .find({
        client_id: clientId,
        status: "in-process",
      })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch proposals",
      error: error.message,
    });
  }
});

// Reject proposal button
app.patch("/task/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Task ID format" });
    }
    const { freelancerId } = req.body;

    const result = await taskCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $pull: {
          applied_freelancers: freelancerId,
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to reject proposal",
      error: error.message,
    });
  }
});

// Active tasks for freelancer
app.get("/freelancer/active-projects/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await taskCollection
      .find({
        applied_freelancers: userId,
        status: { $in: ["in-process", "completed"] },
      })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch active projects",
      error: error.message,
    });
  }
});

// Client overview
app.get("/client-overview/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    const tasks = await taskCollection
      .find({ client_id: clientId })
      .toArray();

    const totalTasks = tasks.length;
    const openTasks = tasks.filter((task) => task.status === "open").length;
    const inProcessTasks = tasks.filter((task) => task.status === "in-process").length;
    const completedTasks = tasks.filter((task) => task.status === "completed").length;

    const totalSpent = tasks
      .filter((task) => task.status === "completed")
      .reduce((total, task) => total + Number(task.budget || 0), 0);

    res.send({
      totalTasks,
      openTasks,
      inProcessTasks,
      completedTasks,
      totalSpent,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to load client overview",
      error: error.message,
    });
  }
});

// Freelancer overview
app.get("/freelancer-overview/:freelancerId", async (req, res) => {
  try {
    const { freelancerId } = req.params;

    const proposals = await taskCollection
      .find({ applied_freelancers: freelancerId })
      .toArray();

    const inProgressTasks = await taskCollection
      .find({
        status: "in-process",
        applied_freelancers: freelancerId,
      })
      .toArray();

    const completedTasks = await taskCollection
      .find({
        status: "completed",
        paid_freelancer: freelancerId,
      })
      .toArray();

    const totalEarnings = completedTasks.reduce(
      (total, task) => total + Number(task.budget || 0),
      0
    );

    res.send({
      totalProposals: proposals.length,
      inProgressTasks: inProgressTasks.length,
      completedTasks: completedTasks.length,
      totalEarnings,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to load freelancer overview",
      error: error.message,
    });
  }
});

// Admin overview
app.get("/admin-overview", async (req, res) => {
  try {
    const users = await userCollection.find().toArray();
    const tasks = await taskCollection.find().toArray();

    const totalRevenue = tasks.reduce(
      (total, task) => total + Number(task.budget || 0),
      0
    );

    const activeTasks = await taskCollection
      .find({
        status: { $in: ["open", "in-process"] },
      })
      .toArray();

    res.send({
      totalUsers: users.length,
      totalTasks: tasks.length,
      totalRevenue,
      activeTasks: activeTasks.length,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to load admin overview",
      error: error.message,
    });
  }
});

// Users API for admin
app.get("/users", async (req, res) => {
  try {
    const users = await userCollection
      .find()
      .project({
        name: 1,
        email: 1,
        role: 1,
      })
      .toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send({
      message: "Failed to load users",
      error: error.message,
    });
  }
});

// User delete from admin
app.delete("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid User ID format" });
    }
    const result = await userCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    res.send({
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

// Get all tasks for admin
app.get("/tasks", async (req, res) => {
  try {
    const result = await taskCollection
      .find()
      .sort({ _id: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
});

// Start Server locally (do not run app.listen on Vercel)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Export app for Vercel Serverless Functions
module.exports = app;

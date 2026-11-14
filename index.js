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
    const userCollection = db.collection("user");

    console.log("✅ Database selected:", db.databaseName);


    // =========================
    // All API Section
    // =========================


    //all task

app.get("/task", async (req, res) => {
  const limit = Number(req.query.limit) || 8;
  const page = Number(req.query.page) || 1;

  const total_data = await taskCollection.countDocuments();
  const total_page = Math.ceil(total_data / limit);

  const skip = (page - 1) * limit;

  const data = await taskCollection
    .find()
    .skip(skip)
    .limit(limit)
    .toArray();

  res.send({ total_page, skip, page, data });
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


// task post api 
app.post("/task", async (req, res) => {
  const task = req.body;

  const newTask = {
    ...task,
    status: "open",
  };

  const result = await taskCollection.insertOne(newTask);

  res.send(result);
});


// client based tasks
app.get("/client-tasks/:userId", async (req, res) => {
  const userId = req.params.userId;

  const result = await taskCollection
    .find({ client_id: userId })
    .toArray();

  res.send(result);
});


// edit task api

app.patch("/task/:id", async (req, res) => {
  const { id } = req.params;
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
});


// Delete Task API

app.delete("/task/:id", async (req, res) => {
  const { id } = req.params;

  const result = await taskCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});



//  apply for task
app.patch("/task/:id/apply", async (req, res) => {
  const { id } = req.params;
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
});


// my proposal task
app.get("/my-proposals/:userId", async (req, res) => {
  const { userId } = req.params;

  const result = await taskCollection
    .find({
      status: "in-process",
      applied_freelancers: userId,
    })
    .toArray();
     console.log("Found Tasks:", result.length);

  res.send(result);
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
    res.status(500).send({ message: "Failed to fetch proposals" });
  }
});


//reject btn 

app.patch("/task/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
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
    });
  }
});

//active task 


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
          });
        }
      });




      // client over view 
      
app.get("/client-overview/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find all tasks of this client
    const tasks = await taskCollection.find({
      client_id: clientId
    }).toArray();

    // Total tasks
    const totalTasks = tasks.length;

    // Open tasks
    const openTasks = tasks.filter(
      task => task.status === "open"
    ).length;

    // In-process tasks
    const inProcessTasks = tasks.filter(
      task => task.status === "in-process"
    ).length;

    // Completed tasks
    const completedTasks = tasks.filter(
      task => task.status === "completed"
    ).length;

    // Total spent from completed tasks
    const totalSpent = tasks
      .filter(task => task.status === "completed")
      .reduce(
        (total, task) => total + Number(task.budget || 0),
        0
      );

    // Send response
    res.send({
     totalTasks,
  openTasks,
  inProcessTasks,
  completedTasks,
  totalSpent
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to load client overview",
      error: error.message
    });
  }
});



//freelancer overview


app.get("/freelancer-overview/:freelancerId", async (req, res) => {
  try {
    const { freelancerId } = req.params;

    // Total Proposals
    const proposals = await taskCollection
      .find({ applied_freelancers: freelancerId })
      .toArray();

    // In Progress Tasks
    const inProgressTasks = await taskCollection
      .find({
        status: "in-process",
        applied_freelancers: freelancerId,
      })
      .toArray();

    // Completed Tasks
    const completedTasks = await taskCollection
      .find({
        status: "completed",
        paid_freelancer: freelancerId,
      })
      .toArray();

    // Total Earnings
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


// admin over view
app.get("/admin-overview", async (req, res) => {
  try {
    // Total Users
    const users = await userCollection.find().toArray();

    // Total Tasks
    const tasks = await taskCollection.find().toArray();

    // Total Revenue
    const totalRevenue = tasks.reduce(
      (total, task) => total + Number(task.budget || 0),
      0
    );

    // Active Tasks
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



//user api admin 
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
    });
  }
});


//user delete from admin

app.delete("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;

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
    });
  }
});



// Get All Tasks
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
    });
  }
});

// Delete Task
app.delete("/task/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await taskCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Task not found",
      });
    }

    res.send({
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete task",
    });

    }
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

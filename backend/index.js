const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv"); 

const app = express();
const Routes = require("./routes/route.js");

// Load environment variables from .env file
dotenv.config(); // Make sure this is before you access process.env

const PORT = process.env.PORT || 5000;

// Middleware to parse JSON and handle CORS
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("NOT CONNECTED TO NETWORK", err));

// Define Routes
app.use('/', Routes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server started at port no. ${PORT}`);
});

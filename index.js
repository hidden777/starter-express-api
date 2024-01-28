const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require("dotenv").config();

const app = express();
const port = process.env.PORT;
const cors = require('cors');
app.use(cors());

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

const jwt = require('jsonwebtoken');

mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() =>{
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.log("Error connecting to MongoDB", err);
});

app.listen(port, () =>{
    console.log("Server is running on port 8000");
});

const User = require('./models/user');
const Results = require('./models/results');

const sendVerificationEmail = async(email, verificationToken) => {
    const authEmail = process.env.AUTH_EMAIL;
    const authPass = process.env.AUTH_PASS;
    const domainLink = process.env.DOMAIN_LINK;
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth:{
            user: authEmail,
            pass: authPass
        }
    })

    const mailOptions = {
        from: "Psychological First Aid Screening",
        to: email,
        subject: "Email Verification",
        text: `Please click the following link to verify your email: ${domainLink}/verify/${verificationToken}`,
    };

    try{
        await transporter.sendMail(mailOptions);
    } catch(err) {
        console.log("Error sending verification email", err);
    }
}

const sendOTPEmail = async(email, OTP) => {
    const authEmail = process.env.AUTH_EMAIL;
    const authPass = process.env.AUTH_PASS;
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth:{
            user: authEmail,
            pass: authPass
        }
    })

    const mailOptions = {
        from: "Psychological First Aid Screening",
        to: email,
        subject: "OTP for Reset Password",
        text: `The OTP for is : ${OTP}. Please use this OTP to change your password.`,
    };

    try{
        await transporter.sendMail(mailOptions);
    } catch(err) {
        console.log("Error sending OTP email", err);
    }
}

app.post("/register", async(req, res) => {
    try{
        const {name, email, password} = req.body;

        const existingUser = await User.findOne({email});
        if(existingUser) {
            return res.status(400).json({message: "Email already registered!"});
        }

        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash(password, salt);
        const newUser = new User({name, email, password: secPass});

        newUser.verificationToken = crypto.randomBytes(20).toString("hex");

        await newUser.save();

        sendVerificationEmail(newUser.email, newUser.verificationToken);
        res.status(200).json({message: "Registration Link Sent!"});
    } catch(err){
        console.log("Error registering user", err);
        res.status(500).json({message: "Registration failed"});
    }
})

app.get("/verify/:token", async(req, res) => {
    try{
        const token = req.params.token;

        const user = await User.findOne({verificationToken: token});
        if(!user) {
            return res.status(404).json({ message: "Invalid verification token" });
        }

        user.verified = true;
        user.verificationToken = undefined;
        await user.save();
        res.status(200).json({message: "Email verified successfully"});
    } catch(err) {
        res.status(500).json({message: "Email Verification Failed"});
    }
})

const generateSecretKey = () => {
    const secretKey = crypto.randomBytes(32).toString("hex");
  
    return secretKey;
  };
  
const secretKey = generateSecretKey();

app.post("/login", async(req, res) => {
    try{
        const {email, password} = req.body;
        const user = await User.findOne({email});
        
        if(!user) {
            return res.status(401).json({message: "Invalid Email or Password"});
        }
        
        if(!user.verified) {
           return res.status(400).json({message: "User is not verified"});
        }
        
        bcrypt.compare(password, user.password, (err, response)=>{
            if(response) {
                const token = jwt.sign({userId: user._id}, secretKey);
                res.status(200).json({token});
            } else {
                return res.status(401).json({message: "Invalid Password"});
            }
        });
    } catch(err) {
        res.status(500).json({message: "Login Failed"});
    }
})

app.get("/getUser/:userId", async(req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const name = user.name;
        res.status(200).json({name});
    } catch(err) {
        res.status(500).json({ message: "Error retrieveing the User" });
    }
}) 

app.post('/createResult', async(req, res) => {
    try{
        const {userId, result} = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const results = new Results({
            user: userId,
            result: result
        });
        await results.save();
        const resultId = results._id;
        res.status(200).json({resultId});
    } catch(err) {
        console.log("Error Creating the Result", err);
        res.send(500).json({message: "Error Creating the Result"});
    }
})

app.get("/getResults/:userId", async(req, res) => {
    try {
        const userId = req.params.userId;

        const results = await Results.find({user: userId}).populate({path:"user", select: "-results -password -email -verified -__v"}).select("-result -__v");
        console.log(results);
        if(!results || results.length === 0) {
            return  res.status(404).json({message:"No results found for this user"});
        }
        res.status(200).json({results});
    } catch (err) {
        res.status(500).json({ message: "Error while fetching results"});
    }
})

app.get("/getReport/:resultId", async(req, res) => {
    try {
        const resultId = req.params.resultId;
        const report = await Results.findById(resultId).select("result");
        if(!report) {
            return res.status(404).json({message: "No report found"});
        }
        res.status(200).json({report});
    } catch (err) {
        res.status(500).json({ message: "Error while fetching report"});
    }
})
const generateOTP = (length) => { 
    const digits = '0123456789'; 
    let OTP = ''; 
    for (let i = 0; i < length; i++) { 
        OTP += digits[Math.floor(Math.random() * 10)]; 
    } 
    return OTP; 
};

app.get("/sendOTP/:email", async(req, res) => {
    try {
        const email = req.params.email;
        const user = await User.findOne({email: email})
        if(!user) {
            return res.status(401).json({message: "Invalid Email or Password"});
        }
        const OTP = generateOTP(4);
        const token = jwt.sign({otp: OTP}, secretKey);
        sendOTPEmail(email, OTP);
        res.status(200).json({ token: token });
    } catch(err) {
        res.status(500).json({message: "Error while sending OTP"});
    }
})

app.post("/resetPassword", async(req, res) => {
    try{
        const {email, password} = req.body;
        console.log(email);
        const user = await User.findOne({email});
        if(!user) {
            return res.status(401).json({message: "User could not be found"});
        }
        const salt = await bcrypt.genSalt(10);
        const secPass = await bcrypt.hash(password, salt);
        user.password = secPass;
        await user.save();
        res.status(200).json({message: "Reset Password Successful"});
    } catch (err) {
        res.status(500).json({message: "Reset Password Failed"});
    }
})
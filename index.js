const express = require("express");
// const multer = require("multer");
const AWS = require("aws-sdk");
// const uuid = require("uuid").v4;

const mongodb = require("mongodb");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
require("dotenv").config();

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const jwt = require("jsonwebtoken");
const auth = require("./jwt/authorization");
const app = express();
const dbURL = process.env.DB_URL || "mongodb://127.0.0.1:27017";
const port = process.env.PORT || 4000;
app.use(express.json());
app.use(cors());
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ID,
  secretAccessKey: process.env.AWS_SECRET,
  
});

// const storage = multer.memoryStorage({
//   destination: function (req, file, callback) {
//     callback(null, "");
//   },
// });

// const upload = multer({ storage }).single("file");

app.post("/delete/:id",async (req, res) => {
   let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");  
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: req.body.Key,
  };
  console.log(req.body)
  s3.deleteObject(params, async (error, data) => {
    if (error) {
      res.status(500).send(error);
    }
 let dbdelete = await db
      .collection("Users")
      .updateOne(
        { _id: objectId(req.params.id) },
        { $pull: { paths: {Key:req.body.Key} } }
      );
    res.status(200).send({message:'file deleted',dbdelete});
  });
});


app.post("/folder", (req, res) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `EmptyFolder/`,
  };
  s3.putObject(params, (err, data) => {
    if (err) {
      res.status(500).send(error);
    }

    res.status(200).send(data);
  });
});

app.post('/files',auth,(req,res)=>{
 try{
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Delimiter: "/",
      Prefix: req.body.name,
    };
    s3.listObjectsV2(params, (err, data) => {
      if (err) {
        res.status(500).send(error);
      }

      res.status(200).json([data.Contents, data.CommonPrefixes]);
    });

 }catch(error){
 console.log(error);
 res.status(500).json({ message: "error" });
 }
});


// app.get("/file", (req, res) => {
//   const params = {
//     Bucket: process.env.AWS_BUCKET_NAME,
//     // Delimiter: "/",
//     //   Prefix: "files/",
//      Key: `a843f4ac-c425-4e0b-9d11-a362c345e83d.doc`,
//   };
//   s3.getObject(params,(err,data)=>{
//        if (err) {
//          res.status(500).send(error);
//        }
// // var objdata=data.toString('base64')
//        res.status(200).send(data);
//     //    const reader = fs.createReadStream(
//     //      new URL(
//     //        "https://googledriveclone.s3.ap-south-1.amazonaws.com/a843f4ac-c425-4e0b-9d11-a362c345e83d.doc"
//     //      )
//     //    );
//     //    reader.on("data", function (chunk) {
//     //      res.send(chunk.toString());
//     //      console.log(chunk.toString());
//     //    }); 
//   })
//   // var data=s3.getSignedUrl('getObject',params).split('?')
//   // var path=data[0]
// //   s3.listObjectsV2(params, (err, data) => {
// //     if (err) {
// //       res.status(500).send(error);
// //     }

//     // res.status(200).send(data.Contents);
//   });
//   // res.status(200).send(path)


app.get("/", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let data = await db.collection("Users").find().toArray();
    res.status(200).json({ data });
    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.send(500);
  }
});




app.post("/register", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.body.email });
    if (result) {
      res.status(400).json({ message: "User already registered" });
      clientInfo.close();
    } else {
      let salt = await bcrypt.genSalt(15);
      let hash = await bcrypt.hash(req.body.password, salt);
      req.body.password = hash;
      await db.collection("Users").insertOne(req.body);

      // var string = Math.random().toString(36).substr(2, 10);
      // let transporter = nodemailer.createTransport({
      //   host: "smtp.gmail.com",
      //   port: 587,
      //   secure: false, // true for 465, false for other ports
      //   auth: {
      //     user: process.env.SENDER, // generated ethereal user
      //     pass: process.env.PASS, // generated ethereal password
      //   },
      // });

      // // send mail with defined transport object
      // let info = await transporter.sendMail({
      //   from: process.env.SENDER, // sender address
      //   to: req.body.email, // list of receivers
      //   subject: "Activate My Drive Account ✔", // Subject line
      //   text: "Hello world?", // plain text body
      //   html: `<a href="https://s3drive-aws.herokuapp.com/activate/${req.body.email}/${string}">Click on this link to activate your My Drive account</a>`, // html body
      // });
      await db
        .collection("Users")
        .updateOne({ email: req.body.email }, { $set: { status: true } });
      res.status(200).json({
        message:
          "User Registered Successfully. Redirecting to login page...",
        status:true,
      });
      clientInfo.close();
    }
  } catch (error) {
    console.log(error);
  }
});
// api for activation account //
app.get("/activate/:mail/:string", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.params.mail });

    if (result.string == req.params.string) {
      await db
        .collection("Users")
        .updateOne(
          { email: req.params.mail },
          { $set: { string: "", status: true } }
        );
      res.redirect(`https://my--drive.herokuapp.com`);
      res.status(200).json({ message: "activated" });
    } else {
      res.status(200).json({ message: "Link Expired" });
    }

    clientInfo.close();
  } catch (error) {
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.body.email });
    if (result) {
      let isTrue = await bcrypt.compare(req.body.password, result.password);
      let status = result.status;
      if (isTrue) {
        if (status == true) {
          let token = await jwt.sign(
            { userId: result._id, userName: result.name },
            process.env.PASS,
            { expiresIn: "1h" }
          );

          res.status(200).json({ message: "success", id: result._id, token });
        } else {
          res.status(200).json({
            message:
              "Please Click on conformation link send to mail to activate your account",
          });
        }
      } else {
        res.status(200).json({ message: "Login unsuccessful" });
      }
    } else {
      res.status(400).json({ message: "User not registered" });
    }

    clientInfo.close();
  } catch (error) {
    console.log(error);
  }
});

app.post("/forgot", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.body.email });
    if (result) {
      var string = Math.random().toString(36).substr(2, 10);
      let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SENDER, // generated ethereal user
          pass: process.env.PASS, // generated ethereal password
        },
      });

      // send mail with defined transport object
      let info = await transporter.sendMail({
        from: process.env.SENDER, // sender address
        to: req.body.email, // list of receivers
        subject: "Reset Password ✔", // Subject line
        text: "Hello world?", // plain text body
        html: `<a href="https://s3drive-aws.herokuapp.com/auth/${req.body.email}/${string}">Click on this link </a>`, // html body
      });
      await db
        .collection("Users")
        .updateOne({ email: req.body.email }, { $set: { string: string } });
      res
        .status(200)
        .json({ message: "Check your email and reset your password" });
    } else {
      res.status(400).json({ message: "User not registered" });
    }
  } catch (error) {
    console.log(error);
  }
});

// api for forgotpassword  authentification //
app.get("/auth/:mail/:string", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.params.mail });

    if (result.string == req.params.string) {
      res.redirect(
        `https://my--drive.herokuapp.com/reset?${req.params.mail}?${req.params.string}`
      );
      //   res.status(200).json({message:'matched'});
    } else {
      res.status(200).json({ message: "Link Expired" });
    }

    clientInfo.close();
  } catch (error) {
    console.log(error);
  }
});

app.put("/resetpassword/:mail/:string", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let result = await db
      .collection("Users")
      .findOne({ email: req.params.mail });
    if (result.string == req.params.string) {
      let salt = await bcrypt.genSalt(15);
      let hash = await bcrypt.hash(req.body.newPass, salt);
      req.body.newPass = hash;
      let data = await db
        .collection("Users")
        .updateOne(
          { email: req.params.mail },
          { $set: { password: req.body.newPass, string:"" } }
        );
      if (data) {
        res.status(200).json({ message: "Password Updated" });
      }
    }

    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.status(500);
  }
});
app.put("/updateToken/:mail", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let data = await db
      .collection("Users")
      .updateOne({ email: req.params.mail }, { $set: { string: "" } });
    if (data) {
      res.status(200).json({ message: "String Updated" });
    }
    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.send(500);
  }
});

app.get("/user/:id",auth, async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let data = await db
      .collection("Users")
      .findOne({ _id: objectId(req.params.id) });
    res.status(200).json(data);
    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.status(500).json({message:"error"});
  }
});
app.post("/file/:id", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let data = await db
      .collection("Users")
      .updateOne(
        { _id: objectId(req.params.id) },
        { $push: { paths: req.body } }
      );
    res.status(200).json({ data });
    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.status(500);
  }
});
app.post("/folder/:id", async (req, res) => {
  try {
    let clientInfo = await mongoClient.connect(dbURL);
    let db = clientInfo.db("GoogleDrive");
    let data = await db
      .collection("Users")
      .updateOne(
        { _id: objectId(req.params.id) },
        { $push: { folders: req.body } }
      );
    res.status(200).json({ data });
    clientInfo.close();
  } catch (error) {
    console.log(error);
    res.status(500);
  }
})

app.listen(port, () => console.log("your app runs with port:", port));

const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator/check');

const User = require('../models/user');

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      //api_user: 'sgirl4209211@gmail.com',
      api_key:
        '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'

    }
  })
);

exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    oldInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password
      },
      validationErrors: errors.array()
    });
  }

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email or password.',
          oldInput: {
            email: email,
            password: password
          },
          validationErrors: []
        });
      }
      bcrypt
        .compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err);
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Invalid email or password.',
            oldInput: {
              email: email,
              password: password
            },
            validationErrors: []
          });
        })
        .catch(err => {
          console.log(err);
          res.redirect('/login');
        });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    });
  }

  bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] }
      });
      return user.save();
    })
    .then(result => {
      res.redirect('/login');

      return transporter.sendMail({
        to: email,
        from: 'ecommerce.shopnow2611@gmail.com',
        fromname: 'Shopnow',
        subject: 'Signup succeeded!',
        html: `<body>
        <div style='color:black ;width: 40vw ; margin:auto;'>
            <div style="left:0%;display: flex;border-bottom: 1px solid rgb(115, 121, 121);">
                <img src="https://previews.123rf.com/images/makkuro/makkuro1510/makkuro151000145/47163781-sale-colorful-shopping-cart-with-bags-isolated-on-white-background.jpg"
                    width=15% height=15% alt="">
                <div style="margin:5% 20%;font-size: 250%;font-weight: 1000"><i>Shopnow</i></div>
    
            </div>
    
            <h2 style="color:rgb(39, 49, 51)">You successfully signed up!!</h2>
            <h3 style="color:rgb(39, 49, 51)">Welcome to the new world of shopping with fast service and great experience</h3>
            
    
        </div>
    </body>
        `
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: message
  });
};

exports.postReset = (req, res, next) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array()[0]);
    return res.status(422).render('auth/reset', {
      path: '/reset',
      pageTitle: 'Reset',
      errorMessage: errors.array()[0].msg,

      // oldInput: {
      //   email: email,
      //   // password: password
      // },
      //validationErrors: errors.array()
    });
  }
  //console.log('helo');
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        // if (!user) {
        //   req.flash('error', 'No account with that email found.');
        //   return res.redirect('/reset');
        // }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then(result => {
        res.redirect('/');
        transporter.sendMail({
          to: req.body.email,
          from: 'ecommerce.shopnow2611@gmail.com',
          fromname: 'shopnow',
          subject: 'Password reset',
          html: `<body>
          <div style='color:black ;width: 40vw ; margin:auto;'>
              <div style="left:0%;display: flex;border-bottom: 1px solid rgb(115, 121, 121);">
                  <img src="https://previews.123rf.com/images/makkuro/makkuro1510/makkuro151000145/47163781-sale-colorful-shopping-cart-with-bags-isolated-on-white-background.jpg"
                      width=15% height=15% alt="">
                  <div style="margin:5% 20%;color:black;font-size: 250%;font-weight: 1000;"><i>Shopnow</i></div>
      
              </div>
      
              <h2 style="color:rgb(39, 49, 51)">FORGOT YOUR PASSWORD?</h2>
              <!-- <p style="margin-top: -1%;margin-bottom: -1%;font-size: 175%;">No worries</p> -->
              <p style="font-size: 150%;margin-left: 2.5%;color:black">Dear Customer,<br>We received a request to reset the password for
                  your account. If you made this request, please click the following reset button to change
                  <i>shopnow</i> password
              </p>
              <button
                  style="margin-left:35%;padding: 0.5rem 1rem;border-radius: 5px;margin-bottom: 3%;background-color: teal;"><a
                      href="https://node-complete-u.herokuapp.com/reset/${token}"
                      style="text-decoration: none;color:white;font-size: 150%;font-style: inherit;font-weight: 600;">Reset Password</a></button>
      
              <h4 style="margin-left:5px">This reset is valid once and within <em>1 hour</em> only!</h4>
          </div>
      </body>
          `
        });
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then(user => {
      let message = req.flash('error');
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        userId: user._id.toString(),
        passwordToken: token
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  console.log();
  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId
  })
    .then(user => {
      if (!user) {
        req.flash('error', 'Go to reset password again to rechange password');
        //throw new Error('franbb');
        return res.redirect('/login');

      } else {
        resetUser = user;
        return bcrypt.hash(newPassword, 12)
          .then(hashedPassword => {
            resetUser.password = hashedPassword;
            resetUser.resetToken = undefined;
            resetUser.resetTokenExpiration = undefined;
            return resetUser.save();
          })
          .then(result => {
            res.redirect('/login');
          });
      }
    })
    .catch(err => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

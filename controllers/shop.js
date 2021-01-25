const fs = require('fs');
const path = require('path');

//const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_KEY);

var easyinvoice = require('easyinvoice');





const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      let total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: total
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  // Token is created using Checkout or Elements!
  // Get the payment token ID submitted by the form:
  const token = req.body.stripeToken; // Using Express
  let totalSum = 0;

  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      user.cart.items.forEach(p => {
        totalSum += p.quantity * p.productId.price;
      });

      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      const charge = stripe.charges.create({
        amount: totalSum,
        currency: 'inr',
        //description: 'Demo Order',
        source: token,
        metadata: { order_id: result._id.toString() }
      });
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = async (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(async (order) => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      //const pdfDoc = new PDFDocument();
      // res.setHeader('Content-Type', 'application/pdf');
      // res.setHeader(
      //   'Content-Disposition',
      //   'inline; filename="' + invoiceName + '"'
      // );
      // pdfDoc.pipe(fs.createWriteStream(invoicePath));
      // pdfDoc.pipe(res);

      // pdfDoc.fontSize(26).text('Invoice', {
      //   underline: true
      // });
      // pdfDoc.text('-----------------------');
      // let totalPrice = 0;
      // order.products.forEach(prod => {
      //   totalPrice += prod.quantity * prod.product.price;
      //   pdfDoc
      //     .fontSize(14)
      //     .text(
      //       prod.product.title +
      //       ' - ' +
      //       prod.quantity +
      //       ' x ' +
      //       'Rs. ' +
      //       prod.product.price
      //     );
      // });
      // pdfDoc.text('---');
      // pdfDoc.fontSize(20).text('Total Price: Rs. ' + totalPrice);

      // pdfDoc.end();



      var arr = [];
      order.products.forEach(prod => {
        //totalPrice += prod.quantity * prod.product.price;
        arr.push({
          "quantity": prod.quantity,
          "description": prod.product.title,
          "tax": 0,
          "price": prod.product.price
        });
      });

      var d = new Date().getDate() + '-' + (+new Date().getMonth() + 1) + '-' + new Date().getFullYear();
      var data = {
        //"documentTitle": "RECEIPT", //Defaults to INVOICE
        "currency": "INR",
        "taxNotation": "gst", //or gst
        "marginTop": 25,
        "marginRight": 25,
        "marginLeft": 25,
        "marginBottom": 25,
        //"logo": 'shop_logo.jpg',
        "logo": "https://previews.123rf.com/images/makkuro/makkuro1510/makkuro151000145/47163781-sale-colorful-shopping-cart-with-bags-isolated-on-white-background.jpg", //or base64
        //"logoExtension": "png", //only when logo is base64
        "sender": {
          "company": "Shop Now",
          "address": "Sample Street 123",
          "city": "Hyderabad",
          "zip": "500005",
          "country": "India"
          //"custom1": "custom value 1",
          //"custom2": "custom value 2",
          //"custom3": "custom value 3"
        },
        "client": {
          "company": "Client ",
          "address": "Clientstreet 456",
          "zip": "452009",
          "city": "Indore",
          "country": "India"
          //"custom1": "custom value 1",
          //"custom2": "custom value 2",
          //"custom3": "custom value 3"
        },
        "invoiceNumber": Date.now(),
        "invoiceDate": d,
        "products":
          arr
        ,
        "bottomNotice": "Shop till you drop!!"
      };


      const result = await easyinvoice.createInvoice(data);
      await fs.writeFileSync(invoicePath, result.pdf, 'base64');


      await fs.readFile(invoicePath, (err, data) => {
        if (err) {
          next(err);
        }
        const file = fs.createReadStream(invoicePath);

        res.setHeader('content-type', 'application/pdf');
        res.setHeader('content-Disposition', 'inline;fileName="' + invoiceName + '"');
        file.pipe(res);
      })












      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader(
      //     'Content-Disposition',
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   res.send(data);
      // });
      // const file = fs.createReadStream(invoicePath);

      // file.pipe(res);
    })
    .catch(err => next(err));
};

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');//cấu hình CORS

var indexRouter = require('./routes/index');
var indexBanVaKhuVuc = require('./routes/BanVaKhuVuc');
var indexCaLamViec = require('./routes/CaLamViec');
var indexKhachHang = require('./routes/KhachHang');
var indexKho = require('./routes/Kho');
var indexThucDon = require('./routes/ThucDon');
var indexHoaDon = require('./routes/HoaDon');
var indexBep = require('./routes/Bep');
var indexBangDieuKhien = require('./routes/BangDieuKhien');
var usersRouter = require('./routes/users');

var app = express();

app.use(cors());

// //docs API
const swaggerPath = './swagger/swagger.yaml';
const swaggerJSDoc = require('swagger-jsdoc');
const yaml = require('yamljs');
const swaggerUi = require('swagger-ui-express');
// Đọc nội dung từ file Swagger
const swaggerContent = yaml.load(swaggerPath);
app.use('/api', swaggerUi.serve, swaggerUi.serve, swaggerUi.setup(swaggerContent));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'img')));//thiết lập cho phép truy cập file static

app.use('/', indexRouter,indexBanVaKhuVuc,indexCaLamViec,indexKhachHang,indexKho,indexThucDon,indexHoaDon,indexBep,indexBangDieuKhien);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app
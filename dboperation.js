var config = require("./dbconfig");//require() dùng để tải file hoặc gói
const sql = require("mssql");//tải module mssql
const { format } = require('date-fns'); //ép định dạng cho ngày tháng năm
const bcrypt = require('bcrypt'); // dùng để mã hoá mật khẩu và tạo mã phiên đăng nhập
// Tạo một pool kết nối
const pool = new sql.ConnectionPool(config);
// Kết nối đến cơ sở dữ liệu
async function connectToDatabase() {
  try {
    await pool.connect();
    console.log("Đã kết nối tới cơ sở dữ liệu");
  } catch (error) {
    console.log("Lỗi kết nối cơ sở dữ liệu: " + error);
  }
}

// Khi ứng dụng bắt đầu, kết nối tới cơ sở dữ liệu
connectToDatabase();


//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');

    // .query(`SELECT IDNhanVien, HanDangNhap FROM NhanVien WHERE MaDangNhap = @MaDangNhap AND NhanVien.DaXoa = 0`);
    if (result.recordset.length === 0) {
      console.log("Không tìm thấy người dùng với mã đăng nhập:", ss);
      return false;
    } else {
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        console.log("Thời gian đăng nhập đã hết hạn:", ss);
        return false;
      } else {
        //Kiểm tra vai trò
        console.log('ID Nhân VIên: ', result.recordset[0].IDNhanVien);
        let resultVaiTro = await pool
          .request()
          .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByIDNhanVien @IDNhanVien');

        console.log('resultVaiTro.recordset:', resultVaiTro.recordset);
        const permissions = resultVaiTro.recordset.map((row) => row.TenQuyen);;
        for (const p of permissions) {
          console.log(p);
          if (p === permission) {
            console.log('Có quyền truy cập');
            return true; // Nếu tìm thấy quyền khớp với biến permission, trả về true
          }
        }
        console.log('Không có quyền truy cập');
        return false; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra phiên và vai trò:", error);
    throw error;
  }
}


//xử lý tải dữ liệu tài khoản
async function getAccount() {
  try {
    let result = await pool.request().query('EXEC employee_getAccount_getAccount');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//xử lý thêm dữ liệu tài khoản
async function insertAccount(data, ss) {
  try {
    if (await checkSessionAndRole(ss, 'Admin')) {
      const hashedPassword = await bcrypt.hash(data.MatKhau, 10);
      let res = await pool.request()
        .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
        .input('TaiKhoan', sql.VarChar, data.TaiKhoan)
        .input('MatKhau', sql.NVarChar, hashedPassword)
        .input('QuyenTruyCap', sql.NVarChar, data.QuyenTruyCap)
        .input('NamSinh', sql.Date, data.NamSinh)
        .input('GioiTinh', sql.NVarChar, data.GioiTinh)
        .input('DiaChi', sql.NVarChar, data.DiaChi)
        .input('SoDienThoai', sql.Int, data.SoDienThoai)
        .input('TinhTrang', sql.NVarChar, data.TinhTrang)
        .input('NgayVao', sql.Date, data.NgayVao)
        .input('HinhAnh', sql.NVarChar, data.HinhAnh)
        .execute('employee_insertAccount_insertAccount');
      return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
    }
    else {
      return { success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" };
    }
  } catch (error) {
    throw error;
  }
}

//xử lý tải 1 dữ liệu tài khoản
async function getAccountById(ID, ss) {
  try {
    if (await checkSessionAndRole(ss, 'Admin')) {
      let res = await pool.request()
        .input("ID", sql.Int, ID)
        .query(`SELECT IDNhanVien, TenNhanVien, TaiKhoan, QuyenTruyCap,NamSinh, GioiTinh, DiaChi,SoDienThoai,TinhTrang,NgayVao, HinhAnh
        FROM NhanVien
        WHERE NhanVien.DaXoa = 0 AND NhanVien.IDNhanVien = @ID
`);
      return res.recordset;
    }
    else {
      return { success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" };
    }
  } catch (error) {
    throw error;
  }
}
//xử lý sửa tài khoản
async function updateAccount(ID, data, ss) {
  try {
    if (await checkSessionAndRole(ss, 'Admin')) {
      const hashedPassword = await bcrypt.hash(data.MatKhau, 10);
      let res = await pool.request()
        .input('ID', sql.Int, ID)
        .input('TenNhanVien', sql.NVarChar, data.TenNhanVien)
        .input('TaiKhoan', sql.VarChar, data.TaiKhoan)
        .input('MatKhau', sql.NVarChar, hashedPassword)
        .input('QuyenTruyCap', sql.NVarChar, data.QuyenTruyCap)
        .input('NamSinh', sql.Date, data.NamSinh)
        .input('GioiTinh', sql.NVarChar, data.GioiTinh)
        .input('DiaChi', sql.NVarChar, data.DiaChi)
        .input('SoDienThoai', sql.Int, data.SoDienThoai)
        .input('TinhTrang', sql.NVarChar, data.TinhTrang)
        .input('NgayVao', sql.Date, data.NgayVao)
        .input('HinhAnh', sql.NVarChar, data.HinhAnh)
        .query('UPDATE NhanVien SET TenNhanVien=@TenNhanVien, MatKhau=@MatKhau, TaiKhoan=@TaiKhoan,QuyenTruyCap=@QuyenTruyCap,NamSinh=@NamSinh,GioiTinh=@GioiTinh,DiaChi=@DiaChi,SoDienThoai=@SoDienThoai,TinhTrang=@TinhTrang,NgayVao=@NgayVao,HinhAnh=@HinhAnh WHERE IDNhanVien=@ID');
      return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
    }
    else {
      return { success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" };
    }
  } catch (error) {
    throw error;
  }
}

//Hàm xoá tài khoản
async function deleteAccount(ID, ss) {
  try {
    if (await checkSessionAndRole(ss, 'Admin')) {
      const result = await pool.request()
        .input('ID', sql.Int, ID)
        .query('UPDATE NhanVien SET DaXoa = 1 WHERE IDNhanVien = @ID');

      return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
    } else {
      return { success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" };
    }
  } catch (error) {
    throw error;
  }
}

//Hàm khôi phục dữ liệu đã xoá
async function undoDelete(ID, ss) {
  try {
    if (await checkSessionAndRole(ss, 'Admin')) {
      let res = await pool.request()
        .input('ID', sql.Int, ID)
        .query('UPDATE NhanVien SET DaXoa = 0 WHERE IDNhanVien = @ID');
      return res
    }
    else {
      return { success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" };
    }
  } catch (error) {
    throw error;
  }
}

//hàm đăng nhập
async function login(data) {
  try {
    let res = await pool.request()
      .input('TaiKhoan', sql.VarChar, data.TaiKhoan)
      .query('EXEC loginAndPermission_login_getListUsers @TaiKhoan');
    if (res !== undefined && res.recordset.length > 0) {
      let matchedUser;
      for (const user of res.recordset) {
        const isPasswordMatch = await bcrypt.compare(data.MatKhau, user.MatKhau);
        if (isPasswordMatch) {
          matchedUser = user;
          break;
        }
      }
      if (matchedUser) {
        console.log("Tài khoản đã đăng nhập: ", matchedUser);
        const IDNhanVien = matchedUser.IDNhanVien; // Lấy ID từ người dùng khớp
        // Đăng nhập thành công
        const currentTime = Date.now().toString();
        const secret = "VRes"; // Thay đổi chuỗi bí mật thành giá trị thực tế
        const MaDangNhap = bcrypt.hashSync(currentTime + secret, 10);
        //thêm 3 ngày thời hạn
        const currentTime2 = Date.now();
    
        const threeDaysLater = new Date(currentTime2 + (3 * 24 * 60 * 60 * 1000));
        const result = await pool.request()
          .input('MaDangNhap', sql.NVarChar, MaDangNhap)
          .input('HanDangNhap', sql.DateTime, threeDaysLater)
          .input('IDNhanVien', sql.Int, IDNhanVien)
          .query('EXEC loginAndPermission_login_updateUserLogin @MaDangNhap, @HanDangNhap, @IDNhanVien');
        if (result.rowsAffected[0] === 1) {
          return {
            success: true,
            message: 'Đăng nhập thành công!',
            cookieValue: MaDangNhap,
          };
        }
        else {
          console.log("Lỗi không thể cập nhật mã đăng nhập và tên đăng nhập.");
          return {
            success: false,
            message: "Có lỗi xảy ra trong quá trình đăng nhập.",
          };
        }
      } else {
        // Mật khẩu không khớp
        return {
          success: false,
          message: "Tài khoản hoặc mật khẩu không chính xác!",
        };
      }
    } else {
      // Người dùng không tồn tại
      return {
        success: false,
        message: "Tài khoản hoặc mật khẩu không chính xác!",
      };
    }
  } catch (error) {
    throw error;
  }
}

//hàm kiểm tra phiên đăng nhập
async function session(MaDangNhap) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, MaDangNhap.ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
    if (result.recordset.length === 0) {
      return { success: false, message: "Bạn hãy đăng nhập lại!" };
    } else {//nếu mã đăng nhập hợp lệ thì kiểm tra hạn đăng nhập
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        return { success: false, message: "Đăng Nhập Đã Hết Hạn!" };
      } else {//thực hiện trả menu cho front-end
        let resultNhomQuyen = await pool
          .request()
          .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByIDNhanVien @IDNhanVien');
        let menu = [];
        const permissions = resultNhomQuyen.recordset.map((row) => row.NhomQuyen);;
        for (const p of permissions) {
          if (menu.includes(p)) {
            //nếu như tên nhóm quyền đã nằm trong mảng thì không làm gì
          } else {
            menu.push(p);//nếu chưa có thì thêm vào mảng
          }
        }
        return { success: true, nhanvien: result.recordset, menu: menu };
      }
    }
  } catch (error) {
    throw error;
  }
}

















//Xử lý tìm kiếm dữ liệu: 
async function searchData(Search, columnName) {
  try {
    // Giải mã chuỗi tìm kiếm từ URL encoding
    const decodedSearch = decodeURIComponent(Search);
    let pool = await sql.connect(config);
    let res = await pool.request()
      .input('Search', sql.NVarChar(50), `%${decodedSearch}%`)
      .query(`SELECT SoHD, NgayHD, NgayGiao, MaKH, MaNV FROM HoaDon WHERE ${columnName} LIKE @Search`);
    if (res.recordset.length > 0) {
      const result = res.recordset.map(row => {
        const ngayHoaDon = format(new Date(row.NgayHD), 'dd-MM-yyyy');
        const ngayGiao = format(new Date(row.NgayGiao), 'dd-MM-yyyy');
        return {
          SoHD: row.SoHD,
          NgayHD: ngayHoaDon,
          NgayGiao: ngayGiao,
          MaKH: row.MaKH,
          MaNV: row.MaNV
        };
      });
      return { success: true, data: result };
    } else {
      const errorMessage = `Không tìm thấy ${decodedSearch} trong cột ${columnName}`;
      return { success: false, message: errorMessage };
    }
  } catch (error) {
    throw error;
  }
}

//Xử lý lấy dữ liệu từ bảng khách hàng để tạo combobox thêm hoá đơn:
async function getMaKHTenKHCustomers() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT MaKH, TenKH FROM KhachHang');
    return result.recordset;
  } catch (err) {
    console.error("Lỗi khi truy vấn bảng Khách Hàng " + err);
  } finally {
    if (sql) {
      try {
        await sql.close();
        console.log('Đã đóng kết nối tới sql.');
      } catch (err) {
        console.error(err);
      }
    }
  }
}

//Xử lý lấy dữ liệu từ bảng nhân viên để tạo combobox thêm hoá đơn:
async function getMaNVHoNVTenNVNhanVien() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT MaNV, Ho + \' \' + Ten as HoTen FROM NhanVien');
    return result.recordset;
  } catch (err) {
    console.error("Lỗi khi truy vấn bảng Nhân Viên " + err);
  } finally {
    if (sql) {
      try {
        await sql.close();
        console.log('Đã đóng kết nối tới sql.');
      } catch (err) {
        console.error(err);
      }
    }
  }
}


//Xử lý nhập dữ liệu
async function importData(NgayHD, NgayGiao, MaKH, MaNV) {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('NgayHD', sql.DateTime, NgayHD)
      .input('NgayGiao', sql.DateTime, NgayGiao)
      .input('MaKH', sql.Int, MaKH)
      .input('MaNV', sql.Int, MaNV)
      .execute('Insert_HoaDon');
    return result.recordsets;
  } catch (error) {
    console.log("Error: " + error);
    throw error;
  }
}

//Xử lý sửa dữ liệu hàng loạt
async function getDataSelected(recordIds) {
  try {
    let pool = await sql.connect(config);
    let res = await pool.request().query(`SELECT * FROM HoaDon WHERE SoHD IN (${recordIds})`);

    if (res.recordset.length > 0) {
      const result = res.recordset.map(row => {
        const ngayHoaDon = format(new Date(row.NgayHD), 'dd-MM-yyyy');
        const ngayGiao = format(new Date(row.NgayGiao), 'dd-MM-yyyy');
        return {
          SoHD: row.SoHD,
          NgayHD: ngayHoaDon,
          NgayGiao: ngayGiao,
          MaKH: row.MaKH,
          MaNV: row.MaNV
        };
      });
      return result;
    }
  } catch (error) {
    console.log(" mathus-error :" + error);
    throw error;
  }
}



module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getAccount: getAccount,
  insertAccount: insertAccount,
  getAccountById: getAccountById,
  updateAccount: updateAccount,
  searchData: searchData,
  getMaKHTenKHCustomers: getMaKHTenKHCustomers,
  getMaNVHoNVTenNVNhanVien: getMaNVHoNVTenNVNhanVien,
  importData: importData,
  getDataSelected: getDataSelected,
  deleteAccount: deleteAccount,
  undoDelete: undoDelete,
  login: login,
  session: session,
};
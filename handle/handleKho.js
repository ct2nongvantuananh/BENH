const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
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
        let resultVaiTro = await pool
          .request()
          .input('IDNhanVien', sql.Int, result.recordset[0].IDNhanVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByIDNhanVien @IDNhanVien');
        const permissions = resultVaiTro.recordset.map((row) => row.TenQuyen);;
        for (const p of permissions) {
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

/*  Quản lý Đơn vị tính */
//xử lý tải danh sách đơn vị tính
async function getUnit() {
  try {
    let result = await pool.request().query('EXEC inventory_getUnit_getUnit');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá đơn vị tính
async function deleteUnit(ID) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, ID)
      .execute('inventory_deleteUnit_deleteUnit');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm đơn vị tính
async function insertUnit(data) {
  try {
    await pool.request()
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_insertUnit_insertUnit');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật đơn vị tính
async function updateUnit(data) {
  try {
    await pool.request()
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .input('TenDonViTinh', sql.NVarChar, data.TenDonViTinh)
      .execute('inventory_updateUnit_updateUnit');
    return { success: true };
  } catch (error) {
    throw error;
  }
}



/*  Quản lý Phiếu nhập */
//xử lý tải danh sách Phiếu nhập
async function getReceipt() {
  try {
    let result = await pool.request().query('EXEC inventory_getReceipt_getReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Tải 1 phiếu nhập: Lấy danh sách nguyên liệu theo IDPhieuNhap
async function getListIngredientByIDReceipt(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_getReceipt_getListIngredientByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Tải 1 phiếu nhập: Lấy danh sách sản phẩm theo IDPhieuNhap
async function getListProductByIDReceipt(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('inventory_getReceipt_getListProductByIDReceipt');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá phiếu nhập
async function deleteReceipt(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'PhieuNhap')
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}
//xử lý thêm phiếu nhập
function insertReceipt(data) {
  var ghiChu = null
  if (data.GhiChu || data.GhiChu !== '') {//nếu có ghi chú
    ghiChu = data.GhiChu
  }
  const dateParts = data.NgayNhap.split('/');
  const day = dateParts[0];
  const month = dateParts[1];
  const year = dateParts[2];
  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedDay = day < 10 ? `0${day}` : day;
  const formattedDate = `${year}/${formattedMonth}/${formattedDay}`;
  return pool.request()
    .input('IDNhanVien', sql.Int, data.IDNhanVien)
    .input('NgayNhap', sql.DateTime, formattedDate)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .input('NhapNguyenLieu', sql.Bit, data.NhapNguyenLieu)
    .execute('inventory_insertReceipt_insertReceipt')
    .then(result => {
      const IDReceipt = result.recordset[0][''];
      if (!data.NhapNguyenLieu) {
        return data.DanhSach.reduce((p, item) => {
          return p.then(_ => {
            return insertDetailFinishedProduct(IDReceipt, item);
          });
        }, Promise.resolve());
      } else {
        return data.DanhSach.reduce((p, item) => {
          return p.then(_ => {
            return insertDetailIngredient(IDReceipt, item);
          });
        }, Promise.resolve());
      }
    })
    .catch(err => {
      console.error(err);
      throw err;
    });
}

//thêm chi tiết phiếu nhập nguyên liệu
function insertDetailIngredient(IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  return pool.request()
    .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
    .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
    .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
    .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
    .input('DonGiaNhap', sql.Int, item.DonGiaNhap)
    .input('SoLuongTon', sql.Float, item.SoLuongTon)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .execute('inventory_insertReceipt_insertDetailIngredient')
    .then(result => {
      return result;
    });
}
//thêm chi tiết phiếu nhập sản phẩm thành phẩm
function insertDetailFinishedProduct(IDPhieuNhap, item) {
  var ghiChu = null
  if (item.GhiChu || item.GhiChu !== '') {//nếu có ghi chú
    ghiChu = item.GhiChu
  }
  return pool.request()
    .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
    .input('IDSanPham', sql.Int, item.IDSanPham)
    .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
    .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
    .input('DonGiaNhap', sql.Int, item.DonGiaNhap)
    .input('SoLuongTon', sql.Float, item.SoLuongTon)
    .input('GhiChu', sql.NVarChar, ghiChu)
    .execute('inventory_insertReceipt_insertDetailFinishedProduct')
    .then(result => {
      return result;
    });
}

//xử lý cập nhật phiếu nhập
async function updateReceipt(data) {
  try {
    var ghiChu = null;
    if (data.GhiChu || data.GhiChu !== '') {
      ghiChu = data.GhiChu;
    }
    const dateParts = data.NgayNhap.split('/');
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];
    const formattedMonth = month < 10 ? `0${month}` : month;
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedDate = `${year}/${formattedMonth}/${formattedDay}`;
    await pool.request()
      .input('IDPhieuNhap', sql.Int, data.IDPhieuNhap)
      .input('IDNhanVien', sql.Int, data.IDNhanVien)
      .input('NgayNhap', sql.DateTime, formattedDate)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .input('NhapNguyenLieu', sql.Bit, data.NhapNguyenLieu)
      .execute('inventory_updateReceipt_updateReceipt');

    const result = await Promise.all(
      data.DanhSach.map(async (item) => {
        // Gọi sp lấy chi tiết cũ có IDPhieuNhap, IDNguyenLieu
        const oldDetail = await (
          data.NhapNguyenLieu
            ? getDetailIngredientByID(data.IDPhieuNhap, item.IDNguyenLieu)
            : getDetailFinishedProductByID(data.IDPhieuNhap, item.IDSanPham)
        );
        if (oldDetail.length > 0) {
          // Có thì cập nhật
          await (
            data.NhapNguyenLieu
              ? updateDetailIngredient(data.IDPhieuNhap, item)
              : updateDetailFinishedProduct(data.IDPhieuNhap, item)
          );
        } else {
          // Không có thì thêm
          await (
            data.NhapNguyenLieu
              ? insertDetailIngredient(data.IDPhieuNhap, item)
              : insertDetailFinishedProduct(data.IDPhieuNhap, item)
          );
        }
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await (
      data.NhapNguyenLieu
        ? getListIngredientByIDReceipt(data.IDPhieuNhap)
        : getListProductByIDReceipt(data.IDPhieuNhap)
    );
    // Xoá các hàng dữ liệu không có trong danh sách người dùng truyền vào
    const idField = data.NhapNguyenLieu
      ? 'IDNguyenLieu'
      : 'IDSanPham';

    const deleteList = newList.filter(item =>
      !data.DanhSach.find(detail =>
        detail[idField] === item[idField]
      )
    );

    // Xóa các item trong deleteList
    for (const item of deleteList) {
      await (
        data.NhapNguyenLieu
          ? deleteDetailIngredient(data.IDPhieuNhap, item.IDNguyenLieu)
          : deleteDetailFinishedProduct(data.IDPhieuNhap, item.IDSanPham)
      );
    }

    return { success: true, result: result };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
// lấy chi tiết nguyên liệu theo ID
async function getDetailIngredientByID(IDPhieuNhap, IDNguyenLieu) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .execute('inventory_updateReceipt_getDetailIngredientByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// lấy chi tiết sản phẩm theo ID
async function getDetailFinishedProductByID(IDPhieuNhap, IDSanPham) {
  try {
    let result = await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDSanPham', sql.Int, IDSanPham)
      .execute('inventory_updateReceipt_getDetailFinishedProductByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết phiếu nhập nguyên liệu
async function updateDetailIngredient(IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, item.IDNguyenLieu)
      .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
      .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
      .input('DonGiaNhap', sql.Float, item.DonGiaNhap)
      .input('SoLuongTon', sql.Float, item.SoLuongTon)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('inventory_updateReceipt_updateDetailIngredient');
  } catch (error) {
    throw error;
  }
}
//hàm cập nhật chi tiết phiếu nhập sản phẩm thành phẩm
async function updateDetailFinishedProduct(IDPhieuNhap, item) {
  try {
    var ghiChu = null;
    if (item.GhiChu || item.GhiChu !== '') {
      ghiChu = item.GhiChu;
    }
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDSanPham', sql.Int, item.IDSanPham)
      .input('SoLuongNhap', sql.Float, item.SoLuongNhap)
      .input('IDDonViTinh', sql.Int, item.IDDonViTinh)
      .input('DonGiaNhap', sql.Float, item.DonGiaNhap)
      .input('SoLuongTon', sql.Float, item.SoLuongTon)
      .input('GhiChu', sql.NVarChar, ghiChu)
      .execute('inventory_updateReceipt_updateDetailFinishedProduct');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập nguyên liệu
async function deleteDetailIngredient(IDPhieuNhap, IDNguyenLieu) {
  try {
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDNguyenLieu', sql.Int, IDNguyenLieu)
      .execute('inventory_updateReceipt_deleteDetailIngredient');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết phiếu nhập sản phẩm thành phẩm
async function deleteDetailFinishedProduct(IDPhieuNhap, IDSanPham) {
  try {
    await pool.request()
      .input('IDPhieuNhap', sql.Int, IDPhieuNhap)
      .input('IDSanPham', sql.Int, IDSanPham)
      .execute('inventory_updateReceipt_deleteDetailFinishedProduct');
  } catch (error) {
    throw error;
  }
}


//xử lý lấy danh sách nguyên liệu
async function getIngredient() {
  try {
    let result = await pool.request().query('EXEC inventory_getIngredient_getIngredient');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá nguyên liệu
async function deleteIngredient(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .input('NameTable', sql.VarChar, 'NguyenLieu')
      .execute('global_deleteRowTable');
  } catch (error) {
    throw error;
  }
}
//xử lý thêm nguyên liệu
async function insertIngredient(data) {
  try {
    await pool.request()
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .execute('inventory_insertIngredient_insertIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
//xử lý cập nhật nguyên liệu
async function updateIngredient(data) {
  try {
    await pool.request()
      .input('IDNguyenLieu', sql.Int, data.IDNguyenLieu)
      .input('TenNguyenLieu', sql.NVarChar, data.TenNguyenLieu)
      .input('IDDonViTinh', sql.Int, data.IDDonViTinh)
      .execute('inventory_updateIngredient_updateIngredient');
    return { success: true };
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getUnit: getUnit,
  deleteUnit: deleteUnit,
  insertUnit: insertUnit,
  updateUnit: updateUnit,
  getReceipt: getReceipt,
  deleteReceipt: deleteReceipt,
  getListIngredientByIDReceipt: getListIngredientByIDReceipt,
  getListProductByIDReceipt: getListProductByIDReceipt,
  insertReceipt: insertReceipt,
  updateReceipt: updateReceipt,
  getIngredient: getIngredient,
  deleteIngredient: deleteIngredient,
  insertIngredient:insertIngredient,
  updateIngredient:updateIngredient
};
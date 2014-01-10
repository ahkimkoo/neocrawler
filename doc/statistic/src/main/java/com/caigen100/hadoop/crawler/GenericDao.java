package com.caigen100.hadoop.crawler;
/* 
 * 功能：通用的JDBC数据库访问类 
 */  
import java.util.*;  
import java.sql.*;  
import javax.servlet.jsp.jstl.sql.*;  
   
public abstract class GenericDao {  
    // 定义数据库连接  
    private Connection conn;  
   
    // 定义sql语句  
    private String sqlValue;  
   
    // 定义sql语句参数列表  
    private List values;  
   
    /** 
     * 打开连接 
     */  
    private void openConnection() {  
        try {  
            String driverClassName = Env.getInstance().getProperty("driver");  
            String url = Env.getInstance().getProperty("url");  
            String user = Env.getInstance().getProperty("user");  
            String password =Env.getInstance().getProperty("password");  
   
            Class.forName(driverClassName).newInstance();   
            conn = DriverManager.getConnection(url , user , password);            
        } catch (Exception e) {  
            e.printStackTrace();  
        }  
    }  
   
    /** 
     * 设定SQL语句 
     */  
    public void setSqlValue(String sqlValue) {  
        this.sqlValue = sqlValue;  
    }  
   
    /** 
     * 设定SQL语句的参数列表 
     */  
    public void setValues(List values) {  
        this.values = values;  
    }  
   
    /** 
     * 将SQL语句参数列表中的值赋给预执行语句. 
     *  
     * @param pstmt 
     *            预执行语句 
     * @param values 
     *            sql语句参数列表 
     */  
    private void setValues(PreparedStatement pstmt, List values)  
            throws SQLException {  
        // 循环，将SQL语句参数列表中的值依次赋给预执行语句  
        for (int i = 0; i < values.size(); i++) {  
            Object v = values.get(i);  
            // 注意，setObject()方法的索引值从1开始，所以有i+1  
            pstmt.setObject(i + 1, v);  
        }  
    }  
   
    /** 
     * 执行查询 
     *  
     * @return a javax.servlet.jsp.jstl.sql.Result  
     *                返回Result对象result 
     * @exception SQLException 
     *                定义sql异常 
     */  
    public Result executeQuery() throws SQLException {  
   
        // 定义属性  
        Result result = null;  
        ResultSet rs = null;  
        PreparedStatement pstmt = null;  
        Statement stmt = null;  
        openConnection();  
        try {  
            if (values != null && values.size() > 0) {  
                // 使用预处理语句，并设定所有的sql语句所有参数值  
                pstmt = conn.prepareStatement(sqlValue);  
                setValues(pstmt, values);  
                // 执行查询sql语句，返回查询结果集  
                rs = pstmt.executeQuery();  
            } else {  
                stmt = conn.createStatement();  
                rs = stmt.executeQuery(sqlValue);  
            }  
            // 把ResultSet转换为Result  
            result = ResultSupport.toResult(rs);  
        } finally {  
            // 释放资源  
            if (rs != null) {  
                try {  
                    rs.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (stmt != null) {  
                try {  
                    stmt.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (pstmt != null) {  
                try {  
                    pstmt.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (conn != null) {  
                try {  
                    conn.close();  
                } catch (SQLException e) {  
                }  
            }             
        }  
        return result;  
    }  
   
    /** 
     * 执行Update语句 
     *  
     * @return numOfRows  
     *                返回受影响的行数 
     * @exception SQLException 
     *                定义sql异常 
     */  
    public int executeUpdate() throws SQLException {  
        // 定义属性  
        int numOfRows = 0;  
        ResultSet rs = null;  
        PreparedStatement pstmt = null;  
        Statement stmt = null;  
        openConnection();  
        try {  
            if (values != null && values.size() > 0) {  
                // 使用预处理语句，并设定所有的sql语句所有参数值  
                pstmt = conn.prepareStatement(sqlValue);  
                setValues(pstmt, values);  
                numOfRows = pstmt.executeUpdate();  
            } else {  
                // 执行更新sql语句，返回受影响的行数  
                stmt = conn.createStatement();  
                numOfRows = stmt.executeUpdate(sqlValue);  
            }  
        } finally {  
            // 释放资源  
            if (rs != null) {  
                try {  
                    rs.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (stmt != null) {  
                try {  
                    stmt.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (pstmt != null) {  
                try {  
                    pstmt.close();  
                } catch (SQLException e) {  
                }  
            }  
            if (conn != null) {  
                try {  
                    conn.close();  
                } catch (SQLException e) {  
                }  
            }                 
        }  
        return numOfRows;  
    }  
}  
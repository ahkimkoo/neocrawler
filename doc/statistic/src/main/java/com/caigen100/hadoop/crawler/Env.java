package com.caigen100.hadoop.crawler;
/* 
 * 实现读取配置文件 db.properties 的静态类 
 */   
import java.io.InputStream;  
import java.util.Properties;  
   
public final class Env extends Properties{  
   
    //定义变量  
    private static Env instance;  
   
    //以单例模式创建，获得对象实例  
    public static Env getInstance() {  
        if (instance != null) {  
            return instance;  
        }  
        else {  
            makeInstance();  
            return instance;  
        }  
    }  
   
    //同步方法，保证再同一时间，只能被一个调用  
    private static synchronized void makeInstance() {  
        if (instance == null) {  
            instance = new Env();  
        }  
    }  
   
    //调用文件的方法  
    private Env () {  
        InputStream is = getClass().getResourceAsStream("/db.properties");  
        try {  
            load(is);  
        } catch (Exception e) {  
            e.printStackTrace();  
        }  
    }  
}  
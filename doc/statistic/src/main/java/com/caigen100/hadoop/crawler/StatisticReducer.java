/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

package com.caigen100.hadoop.crawler;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.logging.Level;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.log4j.Logger;

/**
 *
 * @author james
 */
public class StatisticReducer extends Reducer<Text, IntWritable, Text, IntWritable>{
    private static final Logger logger = Logger.getLogger(StatisticReducer.class);
    private final GenericDao mysqlDao = new GenericDao() {};
    @Override
    public void reduce(Text key, Iterable<IntWritable> values, Context context) throws IOException, InterruptedException {
           long sum = 0l;
           long count = 0;
           double avg = 0d;
           
           String[] keyArr = key.toString().split("@");
           String label = keyArr[0];
           String dateStr = keyArr[1];
           String domainStr = keyArr[2];
           
           for (IntWritable val : values) {
               sum += val.get();
               count++;
           }
           
           if(label.equals("cost_avg")){
               try {
                   GenericDao mysqlDao = new GenericDao(){};
                   avg = (1.0*sum)/count;
                   logger.debug(dateStr+", "+domainStr+",cost_avg = "+avg);
                   mysqlDao.setSqlValue("select id from dataflow where tdate=? and domain=?");
                   mysqlDao.setValues(Arrays.asList(dateStr,domainStr));
                   int exists = mysqlDao.executeQuery().getRowCount();
                   if(exists>0){
                       mysqlDao.setSqlValue("update dataflow set "+label+"=? where tdate=? and domain=?");
                       mysqlDao.setValues(Arrays.asList(avg,dateStr,domainStr));
                       mysqlDao.executeUpdate();
                   }else{
                       mysqlDao.setSqlValue("insert dataflow ("+label+",tdate,domain)values(?,?,?)");
                       mysqlDao.setValues(Arrays.asList(avg,dateStr,domainStr));
                       mysqlDao.executeUpdate();
                       logger.debug("insert "+label+" => "+avg);
                   }
               } catch (SQLException ex) {
                   java.util.logging.Logger.getLogger(StatisticReducer.class.getName()).log(Level.SEVERE, null, ex);
               }
               
           }else{
               try {
                   GenericDao mysqlDao = new GenericDao(){};
                   mysqlDao.setSqlValue("select id from dataflow where tdate=? and domain=?");
                   mysqlDao.setValues(Arrays.asList(dateStr,domainStr));
                   int exists = mysqlDao.executeQuery().getRowCount();
                   if(exists>0){
                       mysqlDao.setSqlValue("update dataflow set "+label+"=? where tdate=? and domain=?");
                       mysqlDao.setValues(Arrays.asList(sum,dateStr,domainStr));
                       mysqlDao.executeUpdate();
                   }else{
                       mysqlDao.setSqlValue("insert dataflow ("+label+",tdate,domain)values(?,?,?)");
                       mysqlDao.setValues(Arrays.asList(sum,dateStr,domainStr));
                       mysqlDao.executeUpdate();
                       logger.debug("insert "+label+" => "+sum);
                   }
               } catch (SQLException ex) {
                   java.util.logging.Logger.getLogger(StatisticReducer.class.getName()).log(Level.SEVERE, null, ex);
               }
           }
//           context.write(key, new IntWritable(sum));
           
    }
}

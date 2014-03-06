#【NEOCrawler 介绍】

NEOCrawler是nodejs、redis、phantomjs实现的爬虫系统。

* nodejs的非阻塞、异步的特点，用于开发IO密集CPU需求不高的系统表现很出色；
* 网址调度中心，可以控制一定时间后更新抓取，可以限制一个时间片内的并发连接数；
* 集成了phantomjs，无界面的浏览器渲染，可以抓取到js执行后输出的内容，可以定义js动作，在页面上模拟用户操作，返回需要的数据；
* 可以预设cookie，解决需要登录后才能抓取到内容的问题；
* 集成了http proxy功能，所有请求经过proxy router转发到proxy上，访问目标网站的是不同的IP地址，可以避免对方网站屏蔽抓取。
* 不仅仅是将页面html源代码下载下来，还支持实时内容解析，用网址规则来分类，设置不同的结构化摘取规则，摘取规则可以是css选择符、正则表达式。支持多层嵌套摘取。
* 定向抓取可以设置感兴趣的网址规则，爬虫只跟踪符合规则的网址，避免全站下载，浪费资源；
* 根据网址规则分类，设定不同类别的调度权重、重新抓取的周期，调度权重决定了每个抓取时间片内各类网址所占的数目；
* 可以设定页面内容校验规则、排除一些异常页面，可以设定摘取校验规则，只将有效数据入库。爬虫重试多次后抓取异常、校验不通过的抓取将记录下来，便于分析原因；
* 以上提到的所有功能及配置都可以通过web界面进行设置，哪怕是爬虫系统在运行中，调度规则、摘取规则修改后立刻被热刷新到各个爬虫上，爬虫会应用最新的设置；
* 允许多个抓取实例共存，这些实例共享了爬虫系统的主干功能，但各自的配置不同。
* 由三个子系统组成：爬虫系统、调度系统、代理系统；调度系统负责任务调度，决定接下来抓取哪些网页，爬虫系统负责页面下载和结构化摘取，爬虫在检测到网址后将其放入网址库让调度器进行调度，代理系统负责将请求映射到若干http代理服务器上下载资源；
* 爬虫系统结构上参考了scrapy，由core、spider、downloader、extractor、pipeline组成，core是各个组件的联合点和事件控制中心，spider负责队列的进出，downloader负责页面的下载，根据配置规则选择使用普通的html源码下载或者下载后用phantomjs浏览器环境渲染执行js/css，extractor根据摘取规则对文档进行结构化数据摘取，pipeline负责将数据持久化或者输出给后续的数据处理系统。这些组件都提供定制化接口，如果通过配置不能满足需求，可以很容易个性化扩展某个组件的功能。

#【运行环境准备】
* 安装好nodejs 环境，从git仓库clone源码到本地，在文件夹位置打开命令提示符，运行“npm install”安装依赖的模块；
* redis server安装。
* hbase环境，抓取到网页、摘取到的数据将存储到hbase，hbase安装完毕后要讲http rest服务开启，后面的配置中会用到，如果要使用其他的数据库存储，可以不安装hbase，下面的章节中将会讲到如何关闭hbase功能以及定制化自己的存储。

#【实例配置】
* 实例在instance目录下，拷贝一份example，重命名其他的实例名，例如：abc，以下说明中均使用该实例名举例。
* 编辑instance/abc/setting.json

```javascript
{
    /*注意：此处用于解释各项配置，真正的setting.json中不能包含注释*/
    
    "driller_info_redis_db":["127.0.0.1",6379,0],/*网址规则配置信息存储位置，最后一个数字表示redis的第几个数据库*/
    "url_info_redis_db":["127.0.0.1",6379,1],/*网址信息存储位置*/
    "url_report_redis_db":["127.0.0.1",6380,2],/*抓取错误信息存储位置*/
    "proxy_info_redis_db":["127.0.0.1",6379,3],/*http代理网址存储位置*/
    "use_proxy":false,/*是否使用代理服务*/
    "proxy_router":"127.0.0.1:2013",/*使用代理服务的情况下，代理服务的路由中心地址*/
    "download_timeout":60,/*下载超时时间，秒，不等同于相应超时*/
    "save_content_to_hbase":false,/*是否将抓取信息存储到hbase*/
    "crawled_hbase_db":["127.0.0.1",8080,"crawled"],/*hbase rest服务地址及存储的表*/
    "statistic_mysql_db":["127.0.0.1",3306,"crawling","crawler","123"],/*用来存储抓取日志分析结果，需要结合flume来实现，一般不使用此项*/
    "check_driller_rules_interval":120,/*多久检测一次网址规则的变化以便热刷新到运行中的爬虫*/
    "spider_concurrency":5,/*爬虫的抓取页面并发请求数*/
    "spider_request_delay":0,/*两个并发请求之间的间隔时间，秒*/
    "schedule_interval":60,/*调度器两次调度的间隔时间*/
    "schedule_quantity_limitation":200/*调度器给爬虫的最大网址待抓取数量*/
}
```
#【运行】
* 运行调度器
	> node run.js -i abc -a schedule
	
	-i指定了实例名，-a指定了动作schedule，下同

* 运行代理路由
	> node run.js -i abc -a proxy -p 2013 

	此处的-p指定代理路由的端口，如果在本机运行，setting.json的proxy_router及端口为 **127.0.0.1:2013** 

* 运行爬虫
	> node run.js -i abc -a crawl

* 运行WEB配置
	> node run.js -i abc -a config -p 8888

	在浏览器打开**http://localhost:8888**可以在web界面配置抓取规则

* 测试单个页面抓取
	> node run.js -i abc -a test -l "http://domain/page/"

可以在instance/example/logs 下查看输出日志debug-result.json

#【抓取规则配置】
打开web界面,例如：http://localhost:8888/ , 进入“Drilling Rules”，添加规则。这是一个json编辑器，可以在代码模式/可视化模式之间切换。为了方便演示这里以代码模式为准：

```javascript
{
  /*注意：此处用于解释各项配置，真正的配置代码中不能包含注释*/
  "domain": "",/*顶级域名，例如163.com(不带主机名，www.163.com是错误的)*/
  "url_pattern": "",/*网址规则，正则表达式，例如：^http://domain/\d+\.html，限定范围越精确越好*/
  "alias": "",/*给该规则取的别名*/
  "id_parameter": [],/*该网址可以带的有效参数，如果数组第一个值为#，表示过滤一切参数*/
  "encoding": "auto",/*页面编码，auto表示自动检测，可以填写具体值：gbk,utf-8*/
  "type": "node",/*页面类型，分支branch或者节点node*/
  "save_page": true,/*是否保存html源代码*/
  "format": "html",/*页面形式，html/json/binary*/
  "jshandle": false,/*是否需要处理js，决定了爬虫是否用phantomjs加载页面*/
  "extract_rule": {/*摘取规则，后面单独详述*/
    "category": "crawled",
    "rule": {/*如果不摘取数据，rule应该为空*/
      "title": {/*一个摘取单元，后面单独详述*/
        "base": "content",
        "mode": "css",
        "expression": "title",
        "pick": "text",
        "index": 1
      }
    }
  },
  "cookie": [],/*cookie值，有多个object组成，每个object是一个cookie值*/
  "inject_jquery": false,/*在使用phantomjs的情况下是否注入jquery*/
  "load_img": false,/*在使用phantomjs的情况下是否载入图片*/
  "drill_rules": ["a"],/*页面中感兴趣的链接,填写css选择符选择a元素，可以为多个，此处表示所有链接*/
  "drill_relation": {/*一个摘取单元，从页面中摘取一个值来填充上下文关系对此页的描述*/
    "base": "content",
    "mode": "css",
    "expression": "title",
    "pick": "text",
    "index": 1
  },
  "validation_keywords": [],/*验证页面下载是否有效的关键词，可以为多个，为空表示不验证*/
  "script": [],/*在页面中执行的脚本，可以为多个，依次对应每个层级下的执行。以js_result=..形式*/
  "navigate_rule": [],/*自动导航，css选择符，可以为多个，依次对应每个层级，phantomjs将点击匹配的元素进行导航*/
  "stoppage": -1,/*导航几个层级后停止*/
  "priority": 1,/*调度优先级，数字越小越优先*/
  "weight": 10,/*调度权重，数字越大越有限*/
  "schedule_interval": 86400,/*重新调度的周期，单位秒*/
  "active": true,/*是否激活该规则*/
  "seed": [],/*种子地址，重新调度时从这些网址开始*/
  "schedule_rule": "FIFO"/*调度方式，FIFO或者LIFO*/
}
```

## 摘取单元

```javascript
  {
  "base": "content",/*基于什么摘取，网页DOM：content或者给予url*/
    "mode": "css",/*摘取模式，css或者regex表示css选择符或者正则表达式，value表示给固定值*/
    "expression": "title",/*表达式，与mode相对应css选择符表达式或者正则表达式，或者一个固定的值*/
    "pick": "text",/*css模式下摘取一个元素的属性或者值，text、html表示文本值或者标签代码，@href表示href属性值，其他属性依次类推在前面加@符号*/
    "index": 1/*当有多个元素时，选取第几个元素，-1表示选择多个，将返回数组值*/
  }
```

## 摘取规则
```javascript
  /*摘取规则由多个摘取单元构成，它们之间的基本结构如下*/
  "extract_rule": {
      "category": "crawled",/*该节点存储到hbase的表名称*/
      "rule": {/*具体规则*/
        "title": {/*一个摘取单元，规则参考上面的说明*/
          "base": "content",
          "mode": "css",
          "expression": "title",
          "pick": "text",
          "index": 1,
      'subset':{/*子集*/
                'category':'comment',/*属于comment（存储到comment）*/
                'relate':'#title#',/*与上级关联*/
                'mapping':false,/*子集类型，mapping为true将分到另外的表中单独存储*/
                'rule':{
                    'profile': {'base':'content','mode':'css','expression':'.classname','pick':'@href','index':1},/*摘取单元*/
                    'message': {'base':'content','mode':'css','expression':'.classname','pick':'@alt','index':1}	                    
                  },
        'require':['profile']/*必须字段*/
              }
        }
      }
    ,
    'require':['title']/*必须字段，如果里面的值为数组，表示这个数组内的值有任意一个就满足要求，例如[[a,b],c]*/
    }
```

#【联系作者】
* Email: <successage@gmail.com>,
* Blog: <http://my.oschina.net/waterbear>
* QQ: 419117039 

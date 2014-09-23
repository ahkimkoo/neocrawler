#【NEOCrawler 介绍】


NEOCrawler(中文名：牛咖)，是nodejs、redis、phantomjs实现的爬虫系统。代码完全开源，适合用于垂直领域的数据采集和爬虫二次开发。

### 【主要特点】

* 使用nodejs实现，javascipt简单、高效、易学、为爬虫的开发以及爬虫使用者的二次开发节约不少时间；nodejs使用Google V8作为运行引擎，性能可观；由于nodejs语言本身非阻塞、异步的特性，运行爬虫这类IO密集CPU需求不敏感的系统表现很出色，与其他语言的版本简单的比较，开发量小于C/C++/JAVA，性能高于JAVA的多线程实现以及Python的异步和携程方式的实现。

* 调度中心负责网址的调度，爬虫进程分布式运行，即中央调度器统一决策单个时间片内抓取哪些网址，并协调各爬虫工作，爬虫单点故障不影响整体系统。

* 爬虫在抓取时就对网页进行了结构化解析，摘取到需要的数据字段，入库时不仅是网页源代码还有结构化了的各字段数据，不仅使得网页抓取后数据立马可用，而且便于实现入库时的精准化的内容排重。

* 集成了phantomjs。phantomjs是无需图形界面环境的网页浏览器实现，利用它可以抓取需要js执行才产生内容的网页。通过js语句执行页面上的用户动作，实现表单填充提交后再抓取下一页内容、点击按钮后页面跳转再抓取下一页内容等。

* 重试及容错机制。http请求有各种意外情况，都有重试机制，失败后有详细记录便于人工排查。都返回的页面内容有校验机制，能检测到空白页，不完整页面或者是被代理服务器劫持的页面；

* 可以预设cookie，解决需要登录后才能抓取到内容的问题。

* 限制并发数，避免因为连接数过多被源网站屏蔽IP的问题。

* 集成了代理IP使用的功能，此项功能针对反抓取的网站（限单IP下访问数、流量、智能判断爬虫的），需要提供可用的代理IP，爬虫会自主选择针对源网站还可以访问的代理IP地址来访问，源网站无法屏蔽抓取。

* 产品化功能，爬虫系统的基础部分和具体业务实现部分架构上分离，业务实现部分不需要编码，可以用配置来完成。

* Web界面的抓取规则设置，热刷新到分布式爬虫。在Web界面配置抓取规则，保存后会自动将新规则刷新给运行在不同机器上的爬虫进程，规则调整不需要编码、不需要重启程序。

可配置项：

   1). 用正则表达式来描述，类似的网页归为一类，使用相同的规则。一个爬虫系统（下面几条指的都是某类网址可配置项）；

   2). 起始地址、抓取方式、存储位置、页面处理方式等；

   3). 需要收集的链接规则，用CSS选择符限定爬虫只收集出现在页面中某个位置的链接；

   3). 页面摘取规则，可以用CSS选择符、正则表达式来定位每个字段内容要抽取的位置；

   4). 预定义要在页面打开后注入执行的js语句;

   5). 网页预设的cookie;

   6). 评判该类网页返回是否正常的规则，通常是指定一些网页返回正常后页面必然存在的关键词让爬虫检测；

   7). 评判数据摘取是否完整的规则，摘取字段中选取几个非常必要的字段作为摘取是否完整的评判标准；

   8). 该类网页的调度权重（优先级）、周期（多久后重新抓取更新）。

* 为了减少冗余开发，根据抓取需求划分为实例，每个实例的基础配置（存储数据库、爬虫运行参数、定制化代码）都可以不同，即抓取应用配置的层次为：爬虫系统->实例->网址。

* 爬虫系统结构上参考了scrapy，由core、spider、downloader、extractor、pipeline组成，core是各个组件的联合点和事件控制中心，spider负责队列的进出，downloader负责页面的下载，根据配置规则选择使用普通的html源码下载或者下载后用phantomjs浏览器环境渲染执行js/css，extractor根据摘取规则对文档进行结构化数据摘取，pipeline负责将数据持久化或者输出给后续的数据处理系统。这些组件都提供定制化接口，如果通过配置不能满足需求，可以用js代码很容易个性化扩展某个组件的功能。

**详细介绍请查看[Wiki](http://git.oschina.net/dreamidea/neocrawler/wikis/home "wiki"):**

#【运行环境准备】
* 安装好nodejs 环境，从git仓库clone源码到本地，在文件夹位置打开命令提示符，运行“npm install”安装依赖的模块；
* redis server安装（同时支持redis和ssdb，从节约内存的角度考虑，可以使用ssdb，在setting.json可以指定类型，下面会提到）。
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
    "save_content_to_hbase":false,/*是否将抓取信息存储到hbase，目前只在0.94下测试过*/
    "crawled_hbase_conf":{"zookeeperHosts": ["localhost:2181"],"zookeeperRoot": "/hbase"},/*hbase的配置*/
    "crawled_hbase_table":"crawled",/*抓取的数据保存在hbase的表*/
    "crawled_hbase_bin_table":"crawled_bin",/*抓取的二进制数据保存在hbase的表*/
    "statistic_mysql_db":["127.0.0.1",3306,"crawling","crawler","123"],/*用来存储抓取日志分析结果，需要结合flume来实现，一般不使用此项*/
    "check_driller_rules_interval":120,/*多久检测一次网址规则的变化以便热刷新到运行中的爬虫*/
    "spider_concurrency":5,/*爬虫的抓取页面并发请求数*/
    "spider_request_delay":0,/*两个并发请求之间的间隔时间，秒*/
    "schedule_interval":60,/*调度器两次调度的间隔时间*/
    "schedule_quantity_limitation":200,/*调度器给爬虫的最大网址待抓取数量*/
    "download_retry":3,/*错误重试次数*/
    "log_level":"DEBUG",/*日志级别*/
    "use_ssdb":false/*是否使用ssdb*/
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
        "subset":{/*子集*/
              "category":"comment",/*属于comment（存储到comment）*/
              "relate":"#title#",/*与上级关联*/
              "mapping":false,/*子集类型，mapping为true将分到另外的表中单独存储*/
              "rule":{
                  "profile": {"base":"content","mode":"css","expression":".classname","pick":"@href","index":1},/*摘取单元*/
                  "message": {"base":"content","mode":"css","expression":".classname","pick":"@alt","index":1}	                    
                },
              "require":["profile"]/*必须字段*/
            }
      }
    }
  "require":["title"]/*必须字段，如果里面的值为数组，表示这个数组内的值有任意一个就满足要求，例如[[a,b],c]*/
  }
```

#【联系作者】
* Email: <successage@gmail.com>,
* Blog: <http://my.oschina.net/waterbear>
* QQ: 419117039
* 微信： dreamidea
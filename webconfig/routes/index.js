
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Config Home' }, function(err, stuff) {
     if (!err) {
        res.write(stuff);
        res.end();
     }
  });
};

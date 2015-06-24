var gulp = require('gulp');
var uglify = require('gulp-uglify');

gulp.task('script', function() {
    return gulp.src('./assets/js/i18n.js')
        .pipe(uglify())
        .pipe(gulp.dest('./build/js/'));
});

gulp.task('default', ['script']);
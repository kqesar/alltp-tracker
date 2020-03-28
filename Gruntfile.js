module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        connect: {
            server: {
                options: {
                    base: 'dist',
                    port: 8000,
                    livereload: true
                },
            }
        },
        sass: {
            dist: {
                files: {
                    'dist/css/style.css': 'src/scss/style.scss',
                }
            }
        },
        watch: {
            options: {
                livereload: true,
            },
            html: {
                files: ['dist/index.html'],
            },
            sass: {
                options: {
                    livereload: true
                },
                files: ['src/scss/**/*.scss'],
                tasks: ['sass'],
            },
            css: {
                files: ['dist/css/*.css'],
                tasks: []
            }
        }
    });

    // Actually running things.
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');

    grunt.registerTask('default', ['connect', 'watch']);
};
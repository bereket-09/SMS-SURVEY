@echo off

REM Create required directories if they don't exist
if not exist controllers mkdir controllers
if not exist models mkdir models
if not exist routes mkdir routes
if not exist middlewares mkdir middlewares
if not exist config mkdir config

REM Create empty files if they don't exist
cd controllers
if not exist authController.js type nul > authController.js
if not exist surveyController.js type nul > surveyController.js
if not exist reportController.js type nul > reportController.js
cd ..

cd models
if not exist User.js type nul > User.js
if not exist Survey.js type nul > Survey.js
if not exist Report.js type nul > Report.js
cd ..

cd routes
if not exist authRoutes.js type nul > authRoutes.js
if not exist surveyRoutes.js type nul > surveyRoutes.js
if not exist reportRoutes.js type nul > reportRoutes.js
cd ..

cd middlewares
if not exist authentication.js type nul > authentication.js
if not exist authorization.js type nul > authorization.js
cd ..

cd config
if not exist dbConfig.js type nul > dbConfig.js
if not exist authConfig.js type nul > authConfig.js
cd ..

REM Create empty files in root directory if they don't exist
if not exist index.js type nul > index.js
if not exist app.js type nul > app.js
if not exist db.js type nul > db.js

REM Display success message
echo Directory structure and files created successfully!
# numbers-o-matic

A web-app built to run on Google App Engine with:

* a login/logout interface that allows logging in via username/password or Google OAuth2
* a page with a detailed log of the website activity
* a page where to launch a number crunching simulation, done as 100 batched processes running in paralell, each generating 1000 random numbers between 0 and 50
* a page where to check:
  * how many different numbers have been generated
  * their distribution
  * the most frequent number
  * the overall computation time

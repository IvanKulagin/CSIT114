const express = require("express")
const path = require("path")
const { formidable } = require("formidable")

const { register, validate, login, logout } = require("./session")
const { pool, update_profile } = require("./database")

const router = express.Router()

function isStudent (req, res, next) {
    if (req.session.user && req.session.role === "student") next()
    else res.redirect("/student/login")
}

router.get("/", (req, res) => {
    res.redirect("/student/internship")
})

router.route("/register")
    .get((req, res) => {
        const error = req.session.error
        req.session.error = null
        res.render("register_student", { error })
    })
    .post(express.urlencoded(), register("student"), login("student"), (req, res) => {
        res.redirect("/student/internship")
    })

router.route("/login")
    .get((req, res) => {
        const error = req.session.error
        req.session.error = null
        res.render("login_student", { error })
    })
    .post(express.urlencoded(), validate("student"), login("student"), (req, res) => {
        res.redirect("/student/internship")
    })

router.get("/logout", isStudent, logout, (req, res) => {
    res.redirect("/")
})

router.route("/profile")
    .get(isStudent, (req, res) => {
        pool.query("select * from student where id = ?", [req.session.user], (err, result) => {
            if (err) throw err
            const error = req.session.error
            req.session.error = null
            res.render("student_profile", { ...result[0], error })
        })
    })
    .post(express.urlencoded(), isStudent, update_profile("student", ["name", "email", "phone", "university", "major", "year", "bio"]), (req, res) => {
        res.redirect("/student/internship")
    })

router.route("/internship")
    .get(isStudent, (req, res) => {
        pool.query("select * from company", (err, result) => {
            if (err) throw err
            res.render("student_dashboard", {
                companies: result
            })
        })
    })
    .post(express.json(), isStudent, (req, res) => {
        query = "select internship.*, name from internship join company on company_id = company.id where duration <= ? and salary >= ? and "
        params = [req.body.duration, req.body.salary]
        tokens = []
        req.body.search.forEach(token => {
            tokens.push("(title like ? or location like ?)")
            params.push(`%${token}%`)
            params.push(`%${token}%`)
        })
        query += tokens.join(" and ")
        if (req.body.company.length > 0) {
            query += " and company_id in (?)"
            params.push(req.body.company)
        }
        if (req.body.type.length > 0) {
            query += " and type in (?)"
            params.push(req.body.type)
        }
        pool.query(query, params, (err, result) => {
            if (err) throw err
            res.send(result)
        })
    })

router.get("/internship/:id", isStudent, (req, res) => {
    pool.query("select internship.*, company.name, application.id as application, status from internship join company on company_id = company.id left join (select * from application where student_id = ?) application on internship.id = internship_id where internship.id = ?", [req.session.user, req.params.id], (err, result) => {
        res.render("student_internship", result[0])
    })
})

router.route("/internship/:id/apply")
    .get(isStudent, (req, res) => {
        pool.query("select * from internship where internship.id = ?", [req.params.id], (err, result) => {
            if (err) throw err
            res.render("create_application", result[0])
        })
    })
    .post(isStudent, (req, res) => {
        const form = formidable({ uploadDir: path.join(__dirname, "uploads") });
        form.parse(req, (err, fields, files) => {
            if (err) throw err
            pool.query("insert into application values (null, ?, ?, ?, ?, ?, null)", [req.params.id, req.session.user, files.cv[0].newFilename, files.cv[0].originalFilename, fields.about[0]], (err, result) => {
                if (err) throw err
                res.redirect("/student/internship")
            })
        })
    })

router.get("/applications", isStudent, (req, res) => {
    pool.query("select application.*, title, name from application join internship on internship_id = internship.id join company on company_id = company.id where student_id = ?", [req.session.user], (err, applications) => {
        res.render("student_applications", { applications })
    })

})

module.exports = router

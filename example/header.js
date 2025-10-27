function header(title) {
    return t.header({},
        t.nav({ style: "display: flex; gap: 10px; align-items: center;" },
            t.a({ href: "#/" }, "Home"),
            t.a({ href: "#/page1" }, "Page 1"),
            t.a({ href: "#/page2" }, "Page 2"),
        ),
        t.hr(),
        t.h1({}, title),
        t.hr(),
    )
}

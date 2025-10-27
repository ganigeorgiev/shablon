function page1() {
    const data = store({
        count: 0,
    })

    return t.div({},
        header("Page1"),
        t.p({}, "This is page 1!"),
        t.button({ onclick: () => data.count-- }, "-"),
        t.strong({ style: "margin: 0 10px;" }, () => data.count),
        t.button({ onclick: () => data.count++ }, "+"),
    )
}

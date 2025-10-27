function page2() {
    const data = store({
        list: [],
        newTitle: "",
    })

    return t.div({},
        header("Page2"),
        t.p({}, "This is page 2!"),
        t.input({ placeholder: "New todo title", value: () => data.newTitle, oninput: (e) => data.newTitle = e.target.value }),
        t.button({ onclick: () => data.newTitle && data.list.push({ title: data.newTitle }) }, "Add new todo"),
        t.ul({},
            () => {
                return data.list.map((item) => {
                    return t.li({ rid: item },
                        () => item.title,
                        t.button({ onclick: () => data.list.splice(data.list.findIndex((v) => v == item), 1)}, "X"),
                    )
                })
            }
        ),
        t.pre({}, () => JSON.stringify(data.list, null, 2)),
    )
}

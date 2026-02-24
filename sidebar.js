class AppSidebar extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active") ?? "";

    this.innerHTML = `
      <style>
        .sidebar { width: 16rem; background:#f1f1f1; height:100vh; }
        .sidebar a { display:block; padding:1rem; color:black; text-decoration:none; }
        .sidebar a.active { background:#acabab; color:white; }
        .sidebar ul {margin: 0;padding: 0;list-style: none;}
      </style>

      <div class="sidebar">
        <ul>
          <a style="font-weight:bold; font-size:large;">Dashboard</a>
          <a href="mainPage.html" class="${active === "home" ? "active" : ""}">Home</a>
          <a href="profilePage.html" class="${active === "profile" ? "active" : ""}">Profile</a>
          <a href="projectPage.html" class="${active === "project" ? "active" : ""}">Project</a>
          <a href="#">Teams</a>
        </ul>
      </div>
    `;
  }
}

customElements.define("app-sidebar", AppSidebar);
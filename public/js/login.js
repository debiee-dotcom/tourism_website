

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!role || !email || !password) {
        message.textContent = "Please fill in all required fields.";
        message.style.color = "#b42318";
        return;
    }

    message.textContent =
        "Login form validated. Backend authentication is not connected yet.";
    message.style.color = "#235347";
});

document.getElementById("forgotPassword")
    .addEventListener("click", function (event) {
        event.preventDefault();

        message.textContent =
            "Password recovery will be available in a future update.";
        message.style.color = "#235347";
    });
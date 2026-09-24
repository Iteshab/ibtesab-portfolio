const sb = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const ADMIN_EMAIL = 'ibtesabalam7@gmail.com';

const $ = (id) => document.getElementById(id);

const loginForm = $('loginForm');
const loginMsg = $('loginMsg');
const loginPanel = $('loginPanel');
const app = $('app');
const logoutBtn = $('logoutBtn');

function showMessage(text, type = '') {
  loginMsg.textContent = text;
  loginMsg.className = 'msg ' + type;
}

function showApp(isLoggedIn) {
  loginPanel.classList.toggle(
    'hidden',
    isLoggedIn
  );

  app.classList.toggle(
    'hidden',
    !isLoggedIn
  );

  logoutBtn.classList.toggle(
    'hidden',
    !isLoggedIn
  );
}

async function checkLogin() {

  const {
    data,
    error
  } = await sb.auth.getUser();

  console.log('GET USER:', data);
  console.log('GET USER ERROR:', error);

  if (error || !data.user) {
    showApp(false);
    return;
  }

  console.log(
    'LOGGED USER:',
    data.user.email
  );

  showApp(true);
}

loginForm.addEventListener(
  'submit',
  async function (e) {

    e.preventDefault();

    showMessage('Signing in...');

    const email =
      $('email').value.trim();

    const password =
      $('password').value;

    console.log('LOGIN EMAIL:', email);

    const {
      data,
      error
    } = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    console.log('LOGIN DATA:', data);
    console.log('LOGIN ERROR:', error);

    if (error) {

      showMessage(
        error.message,
        'error'
      );

      return;
    }

    if (!data.user) {

      showMessage(
        'Login succeeded but user session was not returned.',
        'error'
      );

      return;
    }

    if (
      data.user.email.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {

      await sb.auth.signOut();

      showMessage(
        'Logged in with the wrong account: ' +
        data.user.email,
        'error'
      );

      return;
    }

    showMessage(
      'Login successful!',
      'ok'
    );

    showApp(true);

  }
);

logoutBtn.addEventListener(
  'click',
  async function () {

    await sb.auth.signOut();

    showApp(false);

    loginForm.reset();
  }
);

checkLogin();

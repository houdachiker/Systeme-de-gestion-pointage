import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

/* Clés d'authentification gérées par ce contexte
   IMPORTANT : on ne touche PAS aux autres clés du localStorage
   (notamment workpulse_read_* qui sert à mémoriser les notifications lues). */
const AUTH_KEYS = ['token', 'role', 'nom', 'id'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    const nom   = localStorage.getItem('nom');
    const id    = localStorage.getItem('id');
    return token ? { token, role, nom, id } : null;
  });

  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('role',  data.role);
    localStorage.setItem('nom',   data.nom);
    localStorage.setItem('id',    data.id);
    setUser(data);
  };

  const logout = () => {
    /* Suppression ciblée : on garde les notifications lues (workpulse_read_*)
       et les autres préférences utilisateur. */
    AUTH_KEYS.forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

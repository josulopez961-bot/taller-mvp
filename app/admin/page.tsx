export default function AdminPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#000",
      color: "#fff"
    }}>
      <div style={{
        background: "#111",
        padding: "30px",
        borderRadius: "12px",
        width: "320px"
      }}>
        <h2>Ingreso al Panel</h2>

        <input
          type="password"
          placeholder="Contraseña"
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "10px",
            marginBottom: "10px",
            borderRadius: "6px"
          }}
        />

        <button style={{
          width: "100%",
          padding: "10px",
          background: "#16a34a",
          border: "none",
          borderRadius: "6px",
          color: "#fff"
        }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

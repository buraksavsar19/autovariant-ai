import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Ana sayfaya gidince direkt variant-creator'a yönlendir
    navigate("/variant-creator", { replace: true });
  }, [navigate]);
  
  return null;
}

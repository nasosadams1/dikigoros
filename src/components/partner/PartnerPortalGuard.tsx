import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getPartnerSession } from "@/lib/platformRepository";

const PartnerPortalGuard = () => {
  const location = useLocation();
  const session = getPartnerSession();

  if (!session) {
    return <Navigate to="/for-lawyers/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default PartnerPortalGuard;

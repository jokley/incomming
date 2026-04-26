import { Outlet, NavLink } from 'react-router';
import { LayoutDashboard, Users, Hotel, UserCheck, Calendar } from 'lucide-react';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-blue-600">Freestyle WM 2027</h1>
              </div>
              <div className="ml-10 flex space-x-8">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/athletes"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  <Users className="w-5 h-5 mr-2" />
                  Athleten
                </NavLink>
                <NavLink
                  to="/hotels"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  <Hotel className="w-5 h-5 mr-2" />
                  Hotels
                </NavLink>
                <NavLink
                  to="/assignments"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  <UserCheck className="w-5 h-5 mr-2" />
                  Zuweisungen
                </NavLink>
                <NavLink
                  to="/events"
                  className={({ isActive }) =>
                    `inline-flex items-center px-3 py-2 border-b-2 transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Events
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";

interface SubAdminUserManagementProps {
  departmentId: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  email?: string;
  enrollments_count?: number;
  certificates_count?: number;
  completed_courses?: number;
}

export const SubAdminUserManagement = ({ departmentId }: SubAdminUserManagementProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDepartmentUsers();
  }, [departmentId]);

  const fetchDepartmentUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles in this department
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("department_id", departmentId)
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch additional data for each user
      const userIds = profiles.map(p => p.id);

      // Get enrollments count for each user
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id, completed_at")
        .in("user_id", userIds);

      // Get certificates count for each user
      const { data: certificates } = await supabase
        .from("certificates")
        .select("user_id")
        .in("user_id", userIds);

      // Build user data with stats
      const usersWithStats = profiles.map(profile => {
        const userEnrollments = enrollments?.filter(e => e.user_id === profile.id) || [];
        const userCertificates = certificates?.filter(c => c.user_id === profile.id) || [];
        const completedCourses = userEnrollments.filter(e => e.completed_at).length;

        return {
          ...profile,
          enrollments_count: userEnrollments.length,
          certificates_count: userCertificates.length,
          completed_courses: completedCourses,
        };
      });

      setUsers(usersWithStats);
    } catch (error) {
      console.error("Error fetching department users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Department Users
            </CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? "s" : ""} in your department
            </CardDescription>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {searchQuery ? "No users found matching your search" : "No users in this department yet"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-center">Enrollments</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Certificates</TableHead>
                <TableHead className="text-center">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const progressPercent = user.enrollments_count && user.enrollments_count > 0
                  ? Math.round(((user.completed_courses || 0) / user.enrollments_count) * 100)
                  : 0;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{user.enrollments_count || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        {user.completed_courses || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-primary border-primary">
                        {user.certificates_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">{progressPercent}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

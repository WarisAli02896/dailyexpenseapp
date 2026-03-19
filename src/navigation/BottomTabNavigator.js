import React from 'react';
import { Platform, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/home/HomeScreen';
import DueAmountScreen from '../screens/due/DueAmountScreen';
import AccountsScreen from '../screens/accounts/AccountsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { COLORS } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { logoutUser } from '../services/authService';
import { showAlert, showConfirm } from '../utils/alertUtils';
import { AUTH_MESSAGES } from '../messages/authMessages';
import { HeaderTitleWithAccount } from '../components/common';

const Tab = createBottomTabNavigator();

const getTabIcon = (routeName, focused) => {
  const icons = {
    Home: focused ? 'home' : 'home-outline',
    DueAmount: focused ? 'receipt' : 'receipt-outline',
    Accounts: focused ? 'people' : 'people-outline',
    Settings: focused ? 'settings' : 'settings-outline',
  };
  return icons[routeName] || 'help-circle-outline';
};

const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const { logout } = useAuth();

  const handleLogout = () => {
    showConfirm('Logout', 'Are you sure you want to logout?', async () => {
      try {
        const result = await logoutUser();
        if (result.success) {
          logout();
        } else {
          showAlert('Error', result.message);
        }
      } catch (error) {
        showAlert('Error', AUTH_MESSAGES.LOGOUT_FAILED);
      }
    });
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={getTabIcon(route.name, focused)}
            size={size}
            color={color}
          />
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.borderLight,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.textWhite,
        headerTitleAlign: 'center',
        headerTitle: ({ children }) => <HeaderTitleWithAccount title={children} />,
        headerRight: () => (
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [{ marginRight: 12, opacity: pressed ? 0.7 : 1 }]}
            role="button"
            aria-label="Logout"
          >
            <Ionicons name="log-out-outline" size={22} color={COLORS.textWhite} />
          </Pressable>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="DueAmount" component={DueAmountScreen} options={{ title: 'Due Amount' }} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;

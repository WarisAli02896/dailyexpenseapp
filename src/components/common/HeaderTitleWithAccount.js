import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { getActivePerson } from '../../services/personService';

const HeaderTitleWithAccount = ({ title }) => {
  const { user } = useAuth();
  const [accountName, setAccountName] = useState('No Account');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadActiveAccount = async () => {
        if (!user) return;
        const result = await getActivePerson(user.id);
        if (!mounted) return;
        setAccountName(result.success && result.data?.name ? result.data.name : 'No Account');
      };

      loadActiveAccount();
      return () => { mounted = false; };
    }, [user])
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>Active: {accountName}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 220,
  },
  title: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
  },
  subtitle: {
    color: COLORS.textWhite + 'D9',
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.medium,
    marginTop: 1,
  },
});

export default HeaderTitleWithAccount;

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { getActivePerson } from '../../services/personService';

const ActiveAccountHeader = () => {
  const { user } = useAuth();
  const [accountName, setAccountName] = useState('No Account');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadActive = async () => {
        if (!user) return;
        const result = await getActivePerson(user.id);
        if (!mounted) return;
        if (result.success && result.data?.name) {
          setAccountName(result.data.name);
        } else {
          setAccountName('No Account');
        }
      };

      loadActive();
      return () => { mounted = false; };
    }, [user])
  );

  return (
    <View style={styles.wrap}>
      <Ionicons name="person-circle-outline" size={15} color={COLORS.textWhite} />
      <Text style={styles.text} numberOfLines={1}>
        {accountName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    gap: 4,
  },
  text: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    flexShrink: 1,
  },
});

export default ActiveAccountHeader;
